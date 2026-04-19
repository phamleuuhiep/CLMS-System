const fs = require('fs');
const path = require('path');

class RuleRepository {
    constructor() {
        this.localRulesPath = path.join(__dirname, '../../data/rules.json');
        this.legacyUsersPath = path.join(__dirname, '../../../CLMS-HK252-main/users.json');
    }

    readJson(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return [];
            }

            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`[RuleRepository] Failed to read ${filePath}:`, error.message);
            return [];
        }
    }

    getRulesFromLocalFile(deviceId) {
        const rules = this.readJson(this.localRulesPath);

        return rules.filter((rule) => rule.deviceId === deviceId);
    }

    getRulesFromLegacyUsers(deviceId) {
        const users = this.readJson(this.legacyUsersPath);
        const deviceRules = [];

        users.forEach((parent) => {
            const linkedChildren = Array.isArray(parent.linkedChildren) ? parent.linkedChildren : [];

            linkedChildren.forEach((child) => {
                if (child.childUsername !== deviceId || !child.safeZone) {
                    return;
                }

                const safeZone = child.safeZone;
                const baseRule = {
                    deviceId,
                    childName: child.childName || deviceId,
                    parentEmail: parent.email || null
                };

                if (safeZone.type === 'polygon' && Array.isArray(safeZone.polygonPoints)) {
                    deviceRules.push({
                        ...baseRule,
                        id: `${deviceId}-polygon`,
                        name: `${child.childName || deviceId} polygon`,
                        type: 'polygon',
                        polygonPoints: safeZone.polygonPoints
                    });
                    return;
                }

                if (safeZone.type === 'zone' || safeZone.type === 'rectangle') {
                    deviceRules.push({
                        ...baseRule,
                        id: `${deviceId}-rectangle`,
                        name: `${child.childName || deviceId} rectangle`,
                        type: 'rectangle',
                        bounds: safeZone.bounds || safeZone
                    });
                    return;
                }

                deviceRules.push({
                    ...baseRule,
                    id: `${deviceId}-point`,
                    name: `${child.childName || deviceId} point`,
                    type: 'point',
                    center: {
                        lat: Number(safeZone.lat),
                        lng: Number(safeZone.lng)
                    },
                    radius: Number(safeZone.radius || 1000)
                });
            });
        });

        return deviceRules;
    }

    getRulesForDevice(deviceId) {
        const localRules = this.getRulesFromLocalFile(deviceId);

        if (localRules.length > 0) {
            return localRules;
        }

        return this.getRulesFromLegacyUsers(deviceId);
    }
}

module.exports = RuleRepository;
