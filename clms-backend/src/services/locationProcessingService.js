const RuleEngine = require('../engine/ruleEngine');

class LocationProcessingService {
    constructor({ io, cache, store, ruleRepository, eventBus, alertCooldownMs = 30000 }) {
        this.io = io;
        this.cache = cache;
        this.store = store;
        this.ruleRepository = ruleRepository;
        this.eventBus = eventBus;
        this.alertCooldownMs = alertCooldownMs;
        this.ruleState = new Map();
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

    getRuleState(ruleKey) {
        return this.ruleState.get(ruleKey) || {
            isOutside: false,
            timerId: null,
            lastEvent: null
        };
    }

    setRuleState(ruleKey, state) {
        this.ruleState.set(ruleKey, state);
    }

    emitAlert(event) {
        this.store.appendViolation(event);
        this.eventBus.emit('ruleViolation', event);

        if (this.io) {
            this.io.emit('securityAlert', event);
        }
    }

    emitSafeEvent(event) {
        this.eventBus.emit('ruleSafe', event);

        if (this.io) {
            this.io.emit('securitySafe', event);
        }
    }

    getRepeatEvaluation(ruleKey, state) {
        const previousEvent = state.lastEvent;
        const deviceId = previousEvent?.deviceId || ruleKey.split(':')[0];
        const location = previousEvent?.location;

        if (!deviceId || !RuleEngine.isValidLocation(location)) {
            return { action: 'stop' };
        }

        const evaluations = RuleEngine.evaluateRules(
            { lat: Number(location.lat), lng: Number(location.lng) },
            this.ruleRepository.getRulesForDevice(deviceId)
        );
        const matchingEvaluation = evaluations.find((evaluation) => evaluation.rule.id === previousEvent.ruleId);

        if (!matchingEvaluation) {
            const hasActiveViolation = evaluations.some((evaluation) => !evaluation.isSafe);
            return { action: hasActiveViolation ? 'stop' : 'safe' };
        }

        if (matchingEvaluation.isSafe) {
            return { action: 'safe', evaluation: matchingEvaluation };
        }

        return { action: 'repeat', evaluation: matchingEvaluation };
    }

    startRepeatTimer(ruleKey) {
        const state = this.getRuleState(ruleKey);
        if (state.timerId) {
            return;
        }

        const timerId = setInterval(() => {
            const latest = this.getRuleState(ruleKey);
            if (!latest.isOutside || !latest.lastEvent) {
                this.stopRepeatTimer(ruleKey);
                return;
            }

            const repeatEvaluation = this.getRepeatEvaluation(ruleKey, latest);
            if (repeatEvaluation.action === 'safe') {
                this.stopRepeatTimer(ruleKey);
                this.emitSafeForClearedRule(latest.lastEvent.deviceId, { ruleKey, state: latest });
                return;
            }

            if (repeatEvaluation.action !== 'repeat') {
                this.stopRepeatTimer(ruleKey);
                return;
            }

            const rule = repeatEvaluation.evaluation.rule;
            const now = Date.now();
            const repeatedEvent = {
                ...latest.lastEvent,
                id: `${ruleKey}:${now}`,
                ruleName: rule.name,
                ruleType: rule.type,
                distance: repeatEvaluation.evaluation.distance || null,
                reason: repeatEvaluation.evaluation.reason,
                occurredAt: new Date(now).toISOString()
            };
            repeatedEvent.message = this.buildViolationMessage(rule, repeatEvaluation.evaluation);
            this.emitAlert(repeatedEvent);
            this.setRuleState(ruleKey, {
                ...latest,
                timerId,
                lastEvent: repeatedEvent
            });
        }, this.alertCooldownMs);
        if (typeof timerId.unref === 'function') {
            timerId.unref();
        }

        this.setRuleState(ruleKey, {
            ...state,
            isOutside: true,
            timerId
        });
    }

    stopRepeatTimer(ruleKey) {
        const state = this.getRuleState(ruleKey);
        if (state.timerId) {
            clearInterval(state.timerId);
        }

        this.setRuleState(ruleKey, {
            isOutside: false,
            timerId: null,
            lastEvent: null
        });
    }

    emitSafeForClearedRule(deviceId, clearedState) {
        const previousEvent = clearedState.state.lastEvent || {};

        this.emitSafeEvent({
            id: `${clearedState.ruleKey}:safe:${Date.now()}`,
            type: 'RULE_SAFE',
            deviceId,
            childName: previousEvent.childName || deviceId,
            ruleId: previousEvent.ruleId || clearedState.ruleKey.replace(`${deviceId}:`, ''),
            ruleName: previousEvent.ruleName || 'Previous safe zone',
            occurredAt: new Date().toISOString(),
            message: 'Child is inside the active safe zone.'
        });
    }

    clearInactiveRuleStates(deviceId, activeRuleKeys) {
        const rulePrefix = `${deviceId}:`;
        const clearedOutsideStates = [];

        Array.from(this.ruleState.keys())
            .filter((ruleKey) => ruleKey.startsWith(rulePrefix) && !activeRuleKeys.has(ruleKey))
            .forEach((ruleKey) => {
                const state = this.getRuleState(ruleKey);
                if (state.isOutside) {
                    clearedOutsideStates.push({ ruleKey, state });
                }
                this.stopRepeatTimer(ruleKey);
            });

        return clearedOutsideStates;
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
        const activeRuleKeys = new Set(
            evaluations
                .filter((evaluation) => evaluation.rule)
                .map((evaluation) => `${deviceId}:${evaluation.rule.id}`)
        );
        const clearedOutsideStates = this.clearInactiveRuleStates(deviceId, activeRuleKeys);
        const violations = evaluations.filter((result) => !result.isSafe);

        if (violations.length === 0) {
            clearedOutsideStates.forEach((clearedState) => {
                this.emitSafeForClearedRule(deviceId, clearedState);
            });
        }

        evaluations.forEach((evaluation) => {
            const rule = evaluation.rule;
            if (!rule) return;

            const ruleKey = `${deviceId}:${rule.id}`;
            if (evaluation.isSafe) {
                const prevState = this.getRuleState(ruleKey);
                this.stopRepeatTimer(ruleKey);
                if (prevState.isOutside) {
                    this.emitSafeEvent({
                        id: `${ruleKey}:safe:${Date.now()}`,
                        type: 'RULE_SAFE',
                        deviceId,
                        childName: rule.childName || deviceId,
                        ruleId: rule.id,
                        ruleName: rule.name,
                        occurredAt: new Date().toISOString(),
                        message: 'Child is back inside the safe zone.'
                    });
                }
            }
        });

        violations.forEach((violation) => {
            const rule = violation.rule;
            const timestamp = Date.now();
            const ruleKey = `${deviceId}:${rule.id}`;

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
            const state = this.getRuleState(ruleKey);
            if (!state.isOutside) {
                this.emitAlert(event); // Immediate first alert as soon as child is outside.
                this.setRuleState(ruleKey, {
                    isOutside: true,
                    timerId: state.timerId || null,
                    lastEvent: event
                });
                this.startRepeatTimer(ruleKey); // Repeat every 30 seconds while still outside.
            } else {
                // Keep latest context for subsequent repeated alerts.
                this.setRuleState(ruleKey, {
                    ...state,
                    lastEvent: event
                });
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
