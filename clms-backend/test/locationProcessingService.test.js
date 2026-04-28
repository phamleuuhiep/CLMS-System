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

test('LocationProcessingService does not warn when child is inside polygon safe zone', async () => {
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
                        id: 'polygon-1',
                        name: 'School Zone',
                        type: 'polygon',
                        polygonPoints: [
                            { lat: 10.79, lng: 106.69 },
                            { lat: 10.81, lng: 106.69 },
                            { lat: 10.8, lng: 106.71 }
                        ],
                        childName: 'Kid A'
                    }
                ];
            }
        },
        eventBus,
        alertCooldownMs: 0
    });

    const result = await service.processLocation('device-1', { lat: 10.8, lng: 106.7 }, 'test');

    assert.equal(result.violations.length, 0);
    assert.equal(emittedEvents.length, 0);
    assert.equal(ioEvents.some((entry) => entry.eventName === 'securityAlert'), false);
});

test('LocationProcessingService clears stale warning state when safe zone type changes', async () => {
    let activeRules = [
        {
            id: 'point-1',
            name: 'Old Home Radius',
            type: 'point',
            center: { lat: 10.8, lng: 106.7 },
            radius: 50,
            childName: 'Kid A'
        }
    ];

    const safeEvents = [];
    const ioEvents = [];
    const eventBus = new EventEmitter();
    eventBus.on('ruleSafe', (event) => safeEvents.push(event));

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
                return activeRules;
            }
        },
        eventBus,
        alertCooldownMs: 100000
    });

    await service.processLocation('device-1', { lat: 10.82, lng: 106.73 }, 'test');
    assert.equal(service.getRuleState('device-1:point-1').isOutside, true);

    activeRules = [
        {
            id: 'polygon-1',
            name: 'New School Zone',
            type: 'polygon',
            polygonPoints: [
                { lat: 10.81, lng: 106.72 },
                { lat: 10.83, lng: 106.72 },
                { lat: 10.82, lng: 106.74 }
            ],
            childName: 'Kid A'
        }
    ];

    const result = await service.processLocation('device-1', { lat: 10.82, lng: 106.73 }, 'test');

    assert.equal(result.violations.length, 0);
    assert.equal(service.getRuleState('device-1:point-1').isOutside, false);
    assert.equal(service.getRuleState('device-1:point-1').timerId, null);
    assert.equal(safeEvents.length, 1);
    assert.equal(safeEvents[0].type, 'RULE_SAFE');
    assert.equal(ioEvents.some((entry) => entry.eventName === 'securitySafe'), true);
});

test('LocationProcessingService repeat timer treats changed polygon containing child as safe', async () => {
    let activeRules = [
        {
            id: 'polygon-1',
            name: 'Old Polygon',
            type: 'polygon',
            polygonPoints: [
                { lat: 10.79, lng: 106.69 },
                { lat: 10.81, lng: 106.69 },
                { lat: 10.8, lng: 106.71 }
            ],
            childName: 'Kid A'
        }
    ];

    const service = new LocationProcessingService({
        io: {
            emit() {}
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
                return activeRules;
            }
        },
        eventBus: new EventEmitter(),
        alertCooldownMs: 100000
    });

    await service.processLocation('device-1', { lat: 10.82, lng: 106.73 }, 'test');
    assert.equal(service.getRuleState('device-1:polygon-1').isOutside, true);

    activeRules = [
        {
            id: 'polygon-1',
            name: 'New Polygon',
            type: 'polygon',
            polygonPoints: [
                { lat: 10.81, lng: 106.72 },
                { lat: 10.83, lng: 106.72 },
                { lat: 10.82, lng: 106.74 }
            ],
            childName: 'Kid A'
        }
    ];

    const repeatEvaluation = service.getRepeatEvaluation(
        'device-1:polygon-1',
        service.getRuleState('device-1:polygon-1')
    );

    assert.equal(repeatEvaluation.action, 'safe');
});
