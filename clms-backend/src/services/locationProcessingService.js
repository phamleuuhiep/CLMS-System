const RuleEngine = require('../engine/ruleEngine');

class LocationProcessingService {
    constructor({ io, cache, store, ruleRepository, eventBus, alertCooldownMs = 60000 }) {
        this.io = io;
        this.cache = cache;
        this.store = store;
        this.ruleRepository = ruleRepository;
        this.eventBus = eventBus;
        this.alertCooldownMs = alertCooldownMs;
        this.lastViolationByRule = new Map();
    }

    buildLocationEntry(deviceId, location, source = 'mqtt') {
        return {
            id: `${deviceId}-${Date.now()}`,
            deviceId,
            lat: Number(location.lat),
            lng: Number(location.lng),
            source,
            receivedAt: new Date().toISOString()
        };
    }

    shouldEmitViolation(ruleKey, timestamp) {
        const lastViolation = this.lastViolationByRule.get(ruleKey);

        if (!lastViolation || timestamp - lastViolation >= this.alertCooldownMs) {
            this.lastViolationByRule.set(ruleKey, timestamp);
            return true;
        }

        return false;
    }

    async processLocation(deviceId, location, source = 'mqtt') {
        const entry = this.buildLocationEntry(deviceId, location, source);

        await this.cache.setLatest(deviceId, entry);
        this.store.appendLocation(entry);

        if (this.io) {
            this.io.emit('locationUpdate', entry);
            this.io.emit('locationData', entry);
        }

        const rules = this.ruleRepository.getRulesForDevice(deviceId);
        const evaluations = RuleEngine.evaluateRules(location, rules);
        const violations = evaluations.filter((result) => !result.isSafe);

        violations.forEach((violation) => {
            const rule = violation.rule;
            const timestamp = Date.now();
            const ruleKey = `${deviceId}:${rule.id}`;

            if (!this.shouldEmitViolation(ruleKey, timestamp)) {
                return;
            }

            const event = {
                id: `${ruleKey}:${timestamp}`,
                type: 'RULE_VIOLATION',
                deviceId,
                childName: rule.childName || deviceId,
                parentEmail: rule.parentEmail || null,
                ruleId: rule.id,
                ruleName: rule.name,
                ruleType: rule.type,
                location: {
                    lat: entry.lat,
                    lng: entry.lng
                },
                distance: violation.distance || null,
                reason: violation.reason,
                occurredAt: new Date(timestamp).toISOString(),
                message: this.buildViolationMessage(rule, violation)
            };

            this.store.appendViolation(event);
            this.eventBus.emit('ruleViolation', event);

            if (this.io) {
                this.io.emit('securityAlert', event);
            }

            console.warn(`[RuleEngine] Violation detected for device ${deviceId} on rule ${rule.name}`);
        });

        return {
            entry,
            evaluations,
            violations
        };
    }

    buildViolationMessage(rule, violation) {
        if (rule.type === 'polygon') {
            return 'Device is outside the configured polygon safe zone.';
        }

        if (rule.type === 'rectangle') {
            return 'Device is outside the configured rectangle safe zone.';
        }

        const distanceText = Number.isFinite(violation.distance) ? ` Current distance: ${violation.distance}m.` : '';
        return `Device is outside the configured point radius of ${rule.radius}m.${distanceText}`;
    }
}

module.exports = LocationProcessingService;
