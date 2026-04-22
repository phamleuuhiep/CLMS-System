const geolib = require('geolib');

class RuleEngine {
    /**
     Feature 1: Point-based radius monitoring (Geofencing with a circular area)
        * Returns true if the child is safe (within the area), false if in violation (outside the area)
     */
    static checkCircleGeofence(currentLocation, centerPoint, radiusInMeters) {
        if (!currentLocation || !centerPoint || !radiusInMeters) return true; // Skip check if any parameter is missing

        // Calculate the actual distance using the Haversine formula
        const distance = geolib.getDistance(
            { latitude: currentLocation.lat, longitude: currentLocation.lng },
            { latitude: centerPoint.lat, longitude: centerPoint.lng }
        );

        // The child is safe if the current distance is <= the allowed radius
        return distance <= radiusInMeters;
    }

    /**
     * Feature 2: Zone-based geofencing (Geofencing with a rectangular area)
     * Returns true if the child is safe (within the area), false if in violation (outside the area)
     */
    static checkRectangleGeofence(currentLocation, zoneBounds) {
        // zoneBounds has the format: { minLat, maxLat, minLng, maxLng }
        if (!currentLocation || !zoneBounds) return true;

        const isInsideLat = currentLocation.lat >= zoneBounds.minLat && currentLocation.lat <= zoneBounds.maxLat;
        const isInsideLng = currentLocation.lng >= zoneBounds.minLng && currentLocation.lng <= zoneBounds.maxLng;

        return isInsideLat && isInsideLng;
    }
    static checkPolygonGeofence(currentLocation, polygonPoints) {
        if (!currentLocation || !polygonPoints || polygonPoints.length < 3) return true;

        const formattedPolygon = polygonPoints.map(p => ({
            latitude: p.lat,
            longitude: p.lng
        }));

        const point = { latitude: currentLocation.lat, longitude: currentLocation.lng };

        return geolib.isPointInPolygon(point, formattedPolygon);
    }
}

module.exports = RuleEngine;