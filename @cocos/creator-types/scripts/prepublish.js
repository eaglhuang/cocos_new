const fs = require('fs');
const path = require('path');

function isNormalizeVersion(version) {
    return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version);
}

async function checkVersion() {
    // Get local package.json version
    const localPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json')));
    const localVersion = localPackage.version;
    const isPublicPackage = localPackage.name === '@editor/creator-types'
    console.log(`Local version: ${localVersion}`);
    if (!isNormalizeVersion(localVersion) && isPublicPackage) {
        console.error('Local version is not normalize');
        process.exit(1);
    }

    if (isPublicPackage && fs.existsSync(path.join(__dirname, '../editor/protected'))) {
        // 检查是否混入 protected 定义
        console.error('Local protected package is not clean');
        process.exit(1);
    }

    try {
        // Fetch GitHub master branch's package.json
        const remotePackageJson = await fetchGitHubJson('https://raw.githubusercontent.com/cocos/creator-types/refs/heads/main/package.json');
        const remotePackage = JSON.parse(remotePackageJson);
        const remoteVersion = remotePackage.version;

        if (localVersion !== remoteVersion) {
            console.error(`\x1b[31mVersion mismatch!\x1b[0m
    Local version: ${localVersion}
    GitHub master version: ${remoteVersion}
    Publish aborted.
    Please update your local version to match the GitHub master version first.
    `);
            process.exit(1);
        }

        console.log(`\x1b[32m✓ Version check passed (${localVersion})\x1b[0m`);
    } catch (error) {
        console.error('\x1b[31mFailed to verify GitHub version:\x1b[0m', error.message);
        process.exit(1);
    }
}

function fetchGitHubJson() {
    return new Promise((resolve, reject) => {
        var myHeaders = new Headers();
        myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");
        myHeaders.append("Accept", "*/*");
        myHeaders.append("Host", "raw.githubusercontent.com");
        myHeaders.append("Connection", "keep-alive");

        var requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        fetch("https://raw.githubusercontent.com/cocos/creator-types/refs/heads/main/package.json", requestOptions)
            .then(response => response.text())
            .then(result => resolve(result))
            .catch(error => reject(error));
    });
}

checkVersion();
