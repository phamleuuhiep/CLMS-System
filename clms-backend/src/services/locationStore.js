const fs = require('fs');
const path = require('path');

class LocationStore {
    constructor(baseDir = path.join(__dirname, '../../data')) {
        this.baseDir = baseDir;
        this.historyPath = path.join(this.baseDir, 'location-history.json');
        this.violationsPath = path.join(this.baseDir, 'violations.json');
        this.ensureFiles();
    }

    ensureFiles() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }

        if (!fs.existsSync(this.historyPath)) {
            fs.writeFileSync(this.historyPath, '[]');
        }

        if (!fs.existsSync(this.violationsPath)) {
            fs.writeFileSync(this.violationsPath, '[]');
        }
    }

    readJson(filePath) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            return [];
        }
    }

    writeJson(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    appendLocation(entry) {
        const history = this.readJson(this.historyPath);
        history.unshift(entry);
        this.writeJson(this.historyPath, history.slice(0, 5000));
    }

    appendViolation(event) {
        const violations = this.readJson(this.violationsPath);
        violations.unshift(event);
        this.writeJson(this.violationsPath, violations.slice(0, 1000));
    }

    getDeviceHistory(deviceId, limit = 50) {
        return this.readJson(this.historyPath)
            .filter((entry) => entry.deviceId === deviceId)
            .slice(0, limit);
    }

    getViolations(limit = 50) {
        return this.readJson(this.violationsPath).slice(0, limit);
    }
}

module.exports = LocationStore;
