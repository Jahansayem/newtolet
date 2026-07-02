import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(rootDir, 'out')
const fallbackOutputDir = path.join(rootDir, 'out-static')
const exportDirName = 'dist-next'

async function main() {
  try {
    await runNextBuild()
    await publishOutput(path.join(rootDir, exportDirName))
  } catch (error) {
    console.error(`Static build failed: ${error.message}`)
    throw error
  }
}

function runNextBuild() {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const command = isWindows ? 'cmd' : 'sh'
    const args = isWindows ? ['/c', 'npm', 'run', 'build:next'] : ['-c', 'npm run build:next']

    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
      shell: true,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`next build failed with exit code ${code ?? 'unknown'}`))
    })
  })
}

async function replaceOutput(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true, force: true })
}

async function publishOutput(sourceDir) {
  try {
    await replaceOutput(sourceDir, outputDir)
    console.log(`Static export updated at: ${outputDir}`)
  } catch (error) {
    if (!isWindowsPermissionError(error)) {
      throw error
    }

    console.warn(`Unable to overwrite ${outputDir}; writing export to ${fallbackOutputDir} instead.`)
    await rm(fallbackOutputDir, { recursive: true, force: true })
    await replaceOutput(sourceDir, fallbackOutputDir)
    console.log(`Static export updated at: ${fallbackOutputDir}`)
  }
}

function isWindowsPermissionError(error) {
  return process.platform === 'win32' && error && typeof error === 'object' && 'code' in error && error.code === 'EPERM'
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
