const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');
const LocationProcessingService = require('../src/services/locationProcessingService');

test('LocationProcessingService emits a ruleViolation event for unsafe location', async () => {
    const emittedEvents = [];
    const ioEvents = [];
    const eventBus = new EventEmitter();

    eventBus.on('ruleViolation', (event) => emittedEvents.push(event));

    const service = new LocationProcessingService({
        io: {
            emit(eventName, payload) {
                ioEvents.push({ eventName, payload });
            }
        },
        cache: {
            async setLatest() {}
        },
        store: {
            appendLocation() {},
            appendViolation() {}
        },
        ruleRepository: {
            getRulesForDevice() {
                return [
                    {
                        id: 'point-1',
                        name: 'Home Radius',
                        type: 'point',
                        center: { lat: 10.8, lng: 106.7 },
                        radius: 50,
                        childName: 'Kid A'
                    }
                ];
            }
        },
        eventBus,
        alertCooldownMs: 0
    });

    const result = await service.processLocation('device-1', { lat: 10.82, lng: 106.73 }, 'test');

    assert.equal(result.violations.length, 1);
    assert.equal(emittedEvents.length, 1);
    assert.equal(emittedEvents[0].type, 'RULE_VIOLATION');
    assert.equal(ioEvents.some((entry) => entry.eventName === 'securityAlert'), true);
});
