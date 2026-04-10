#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArg(name, fallback = '') {
    const flag = `--${name}`;
    const index = process.argv.indexOf(flag);
    if (index < 0 || index + 1 >= process.argv.length) {
        return fallback;
    }
    return process.argv[index + 1];
}

function ensureAbsolute(filePath) {
    if (!filePath) {
        throw new Error('missing --input');
    }
    return path.resolve(filePath);
}

function escapePs(value) {
    return String(value).replace(/'/g, "''");
}

function runPowerShell(script) {
    return execFileSync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { encoding: 'utf8' },
    ).trim();
}

function inspectImage(filePath) {
    const script = [
        'Add-Type -AssemblyName System.Drawing',
        `$path = '${escapePs(filePath)}'`,
        '$img = [System.Drawing.Image]::FromFile($path)',
        '$result = @{ width = $img.Width; height = $img.Height } | ConvertTo-Json -Compress',
        '$img.Dispose()',
        'Write-Output $result',
    ].join('; ');
    return JSON.parse(runPowerShell(script));
}

function resizeImage(inputPath, outputPath, maxWidth) {
    const script = [
        'Add-Type -AssemblyName System.Drawing',
        `$input = '${escapePs(inputPath)}'`,
        `$output = '${escapePs(outputPath)}'`,
        `$maxWidth = ${Number(maxWidth)}`,
        '$src = [System.Drawing.Image]::FromFile($input)',
        '$scale = $maxWidth / [double]$src.Width',
        '$newWidth = $maxWidth',
        '$newHeight = [int][Math]::Round($src.Height * $scale)',
        '$dst = New-Object System.Drawing.Bitmap $newWidth, $newHeight',
        '$g = [System.Drawing.Graphics]::FromImage($dst)',
        '$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
        '$g.DrawImage($src, 0, 0, $newWidth, $newHeight)',
        '$g.Dispose()',
        '$src.Dispose()',
        '$format = [System.Drawing.Imaging.ImageFormat]::Png',
        '$dst.Save($output, $format)',
        '$dst.Dispose()',
        'Write-Output $output',
    ].join('; ');
    return runPowerShell(script);
}

function main() {
    const inputPath = ensureAbsolute(parseArg('input'));
    const maxWidth = Number(parseArg('maxWidth', '125'));
    const outDir = path.resolve(parseArg('outDir', path.join('artifacts', '_view_image')));

    if (!fs.existsSync(inputPath)) {
        throw new Error(`input not found: ${inputPath}`);
    }

    const info = inspectImage(inputPath);
    const result = {
        input: inputPath,
        width: info.width,
        height: info.height,
        maxWidth,
        output: inputPath,
        resized: false,
    };

    if (info.width > maxWidth) {
        fs.mkdirSync(outDir, { recursive: true });
        const baseName = path.basename(inputPath, path.extname(inputPath));
        const outputPath = path.join(outDir, `${baseName}.view-${maxWidth}.png`);
        resizeImage(inputPath, outputPath, maxWidth);
        const resizedInfo = inspectImage(outputPath);
        result.output = outputPath;
        result.width = resizedInfo.width;
        result.height = resizedInfo.height;
        result.resized = true;
    }

    console.log(JSON.stringify(result, null, 2));
}

try {
    main();
} catch (error) {
    console.error(`[prepare-view-image] ${error.message}`);
    process.exit(1);
}
