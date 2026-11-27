/**
 * Study Flow Organizer - Standalone Executable Builder
 *
 * 1. Prepares a launcher stub with embedded Windows icon (RT_ICON/RT_GROUP_ICON)
 * 2. Bundles runtime and static assets with caxa using the custom icon stub
 * 3. Patches the PE header from Console (3) to Windows GUI (2)
 *    to eliminate the black terminal window completely.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OUTPUT_EXE = path.join(DIST_DIR, 'Study_Flow_Organizer.exe');
const ICON_PATH = path.join(ROOT_DIR, 'Study_Flow_Organizer.ico');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readFileWithRetry(filePath, maxRetries = 10, delayMs = 300) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return fs.readFileSync(filePath);
        } catch (err) {
            if ((err.code === 'EBUSY' || err.code === 'EPERM') && i < maxRetries - 1) {
                await sleep(delayMs);
            } else {
                throw err;
            }
        }
    }
}

async function appendFileWithRetry(filePath, data, maxRetries = 10, delayMs = 300) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            fs.appendFileSync(filePath, data);
            return;
        } catch (err) {
            if ((err.code === 'EBUSY' || err.code === 'EPERM') && i < maxRetries - 1) {
                await sleep(delayMs);
            } else {
                throw err;
            }
        }
    }
}

async function unlinkWithRetry(filePath, maxRetries = 5, delayMs = 200) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return;
        } catch {
            await sleep(delayMs);
        }
    }
}

async function main() {
    console.log('==> [1/4] Preparing output directory...');
    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
    }

    console.log('==> [2/4] Preparing runtime launcher stub with embedded icon...');
    let customStubPath = null;
    const tempStub = path.join(DIST_DIR, '__temp_stub.exe');

    try {
        let defaultStubPath = null;
        try {
            const caxaMain = require.resolve('caxa');
            defaultStubPath = path.join(
                path.dirname(caxaMain),
                '..',
                'stubs',
                `stub--${process.platform}--${process.arch}`
            );
        } catch {
            // Fallback
        }

        if (defaultStubPath && fs.existsSync(defaultStubPath)) {
            fs.copyFileSync(defaultStubPath, tempStub);

            if (process.platform === 'win32' && fs.existsSync(ICON_PATH)) {
                let rceditModule;
                try {
                    rceditModule = require('rcedit');
                } catch {
                    // rcedit not installed
                }

                const rcedit = rceditModule?.rcedit || rceditModule;
                if (typeof rcedit === 'function') {
                    console.log(`    Injecting application icon from: ${ICON_PATH}`);
                    await rcedit(tempStub, { icon: ICON_PATH });

                    // Allow file handle release from external rcedit process before reading/appending
                    await sleep(400);

                    // caxa stub relies on the separator to find the payload
                    const sep = Buffer.from('\nCAXACAXACAXA\n');
                    const stubBuf = await readFileWithRetry(tempStub);
                    if (stubBuf.indexOf(sep) === -1) {
                        await appendFileWithRetry(tempStub, sep);
                    }
                    customStubPath = tempStub;
                    console.log('    Stub successfully branded with application icon.');
                } else {
                    console.warn('    [WARN] rcedit unavailable; continuing with default stub.');
                }
            }
        } else {
            console.log('    Using default bundled caxa stub.');
        }

        console.log('==> [3/4] Bundling standalone binary with caxa...');
        const stubArg = customStubPath ? ` --stub "${customStubPath}"` : '';
        const caxaCmd = `npx caxa --input . --output dist/Study_Flow_Organizer.exe --exclude "dist" ".git" "src-tauri" "node_modules/caxa/stubs"${stubArg} -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/desktop/launcher.js"`;
        execSync(caxaCmd, { cwd: ROOT_DIR, stdio: 'inherit' });
    } finally {
        await unlinkWithRetry(tempStub);
    }

    console.log('==> [4/4] Patching PE Header to native Windows GUI subsystem...');
    if (fs.existsSync(OUTPUT_EXE)) {
        const buf = fs.readFileSync(OUTPUT_EXE);
        const peOffset = buf.readUInt32LE(0x3C);
        const subsystemOffset = peOffset + 24 + 68;
        const currentSubsystem = buf.readUInt16LE(subsystemOffset);

        if (currentSubsystem === 3) {
            buf.writeUInt16LE(2, subsystemOffset); // 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI

            let written = false;
            for (let i = 0; i < 5; i++) {
                try {
                    fs.writeFileSync(OUTPUT_EXE, buf);
                    written = true;
                    break;
                } catch (err) {
                    if (err.code === 'EBUSY' && i < 4) {
                        await sleep(800);
                    } else {
                        throw err;
                    }
                }
            }
            if (written) {
                console.log(`    Successfully patched Subsystem from 3 (Console) to 2 (Windows GUI).`);
            }
        } else {
            console.log(`    Subsystem is already ${currentSubsystem}.`);
        }

        const stats = fs.statSync(OUTPUT_EXE);
        console.log(`\n🎉 Build complete!`);
        console.log(`    Output: ${OUTPUT_EXE}`);
        console.log(`    Size  : ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    } else {
        console.error('Build output not found at', OUTPUT_EXE);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[ERROR]', err);
    process.exit(1);
});
