import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempBaseDir = path.join(os.tmpdir(), 'eight-static-builds')
const tempPrefix = path.join(tempBaseDir, 'build-')
const outputDir = path.join(rootDir, 'out')
const fallbackOutputDir = path.join(rootDir, 'out-static')
const exportDirName = 'dist-next'
const includedEntries = [
  '.env',
  '.env.local',
  '.gitignore',
  'app',
  'components',
  'next.config.mjs',
  'package-lock.json',
  'package.json',
  'postcss.config.mjs',
  'public',
  'scripts',
  'src',
]

async function main() {
  await mkdir(tempBaseDir, { recursive: true })
  const tempDir = await mkdtemp(tempPrefix)
  let shouldCleanup = process.env.KEEP_STATIC_BUILD !== '1'

  try {
    await copyProject(tempDir)
    await linkNodeModules(tempDir)
    await runNextBuild(tempDir)
    await publishOutput(path.join(tempDir, exportDirName))
  } catch (error) {
    shouldCleanup = false
    console.error(`Static build workspace preserved at: ${tempDir}`)
    throw error
  } finally {
    if (shouldCleanup) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

async function copyProject(tempDir) {
  for (const entryName of includedEntries) {
    await cp(path.join(rootDir, entryName), path.join(tempDir, entryName), {
      recursive: true,
      force: false,
    })
  }
}

async function linkNodeModules(tempDir) {
  const nodeModulesSource = path.join(rootDir, 'node_modules')
  const nodeModulesTarget = path.join(tempDir, 'node_modules')
  const linkType = process.platform === 'win32' ? 'junction' : 'dir'

  await symlink(nodeModulesSource, nodeModulesTarget, linkType)
}

function runNextBuild(tempDir) {
  return new Promise((resolve, reject) => {
    const command = process.execPath
    const child = spawn(command, [path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build', '--webpack'], {
      cwd: tempDir,
      stdio: 'inherit',
      env: process.env,
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
