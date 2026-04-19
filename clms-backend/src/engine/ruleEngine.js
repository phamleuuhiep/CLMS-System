const geolib = require('geolib');

class RuleEngine {
    static isValidLocation(location) {
        return Number.isFinite(location?.lat) && Number.isFinite(location?.lng);
    }

    static normalizeRule(rule) {
        if (!rule || typeof rule !== 'object') {
            return null;
        }

        if (rule.type === 'zone' || rule.type === 'rectangle') {
            const bounds = rule.bounds || rule;
            const minLat = Number(bounds.minLat);
            const maxLat = Number(bounds.maxLat);
            const minLng = Number(bounds.minLng);
            const maxLng = Number(bounds.maxLng);

            if ([minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
                return {
                    id: rule.id || rule.name || 'rectangle-rule',
                    name: rule.name || 'Rectangle Zone',
                    type: 'rectangle',
                    bounds: { minLat, maxLat, minLng, maxLng }
                };
            }
        }

        if (rule.type === 'polygon' && Array.isArray(rule.polygonPoints) && rule.polygonPoints.length >= 3) {
            return {
                id: rule.id || rule.name || 'polygon-rule',
                name: rule.name || 'Polygon Zone',
                type: 'polygon',
                polygonPoints: rule.polygonPoints
                    .map((point) => ({
                        lat: Number(point.lat),
                        lng: Number(point.lng)
                    }))
                    .filter((point) => this.isValidLocation(point))
            };
        }

        const point = rule.center || rule.point || rule;
        const radius = Number(rule.radius || rule.radiusInMeters);

        if (this.isValidLocation(point) && Number.isFinite(radius) && radius > 0) {
            return {
                id: rule.id || rule.name || 'point-rule',
                name: rule.name || 'Point Radius',
                type: 'point',
                center: {
                    lat: Number(point.lat),
                    lng: Number(point.lng)
                },
                radius
            };
        }

        return null;
    }

    static checkCircleGeofence(currentLocation, centerPoint, radiusInMeters) {
        if (!this.isValidLocation(currentLocation) || !this.isValidLocation(centerPoint) || !Number.isFinite(radiusInMeters)) {
            return true;
        }

        const distance = geolib.getDistance(
            { latitude: currentLocation.lat, longitude: currentLocation.lng },
            { latitude: centerPoint.lat, longitude: centerPoint.lng }
        );

        return distance <= radiusInMeters;
    }

    static checkRectangleGeofence(currentLocation, zoneBounds) {
        if (!this.isValidLocation(currentLocation) || !zoneBounds) {
            return true;
        }

        const isInsideLat = currentLocation.lat >= zoneBounds.minLat && currentLocation.lat <= zoneBounds.maxLat;
        const isInsideLng = currentLocation.lng >= zoneBounds.minLng && currentLocation.lng <= zoneBounds.maxLng;

        return isInsideLat && isInsideLng;
    }

    static checkPolygonGeofence(currentLocation, polygonPoints) {
        if (!this.isValidLocation(currentLocation) || !Array.isArray(polygonPoints) || polygonPoints.length < 3) {
            return true;
        }

        const formattedPolygon = polygonPoints.map((point) => ({
            latitude: point.lat,
            longitude: point.lng
        }));

        return geolib.isPointInPolygon(
            { latitude: currentLocation.lat, longitude: currentLocation.lng },
            formattedPolygon
        );
    }

    static evaluateRule(currentLocation, rule) {
        const normalizedRule = this.normalizeRule(rule);

        if (!normalizedRule || !this.isValidLocation(currentLocation)) {
            return {
                isSafe: true,
                rule: normalizedRule,
                reason: 'skipped'
            };
        }

        if (normalizedRule.type === 'rectangle') {
            const isSafe = this.checkRectangleGeofence(currentLocation, normalizedRule.bounds);

            return {
                isSafe,
                rule: normalizedRule,
                reason: isSafe ? 'inside_rectangle' : 'outside_rectangle'
            };
        }

        if (normalizedRule.type === 'polygon') {
            const isSafe = this.checkPolygonGeofence(currentLocation, normalizedRule.polygonPoints);

            return {
                isSafe,
                rule: normalizedRule,
                reason: isSafe ? 'inside_polygon' : 'outside_polygon'
            };
        }

        const distance = geolib.getDistance(
            { latitude: currentLocation.lat, longitude: currentLocation.lng },
            { latitude: normalizedRule.center.lat, longitude: normalizedRule.center.lng }
        );
        const isSafe = distance <= normalizedRule.radius;

        return {
            isSafe,
            rule: normalizedRule,
            distance,
            reason: isSafe ? 'inside_radius' : 'outside_radius'
        };
    }

    static evaluateRules(currentLocation, rules = []) {
        return rules
            .map((rule) => this.evaluateRule(currentLocation, rule))
            .filter((result) => result.rule);
    }
}

module.exports = RuleEngine;
