'use-strict';

const path = require('path');
const fs = require('fs-extra');
const watch = require('node-watch');
const globToRegExp = require('glob-to-regexp');
const parseGitignore = require('parse-gitignore');
const _ = require('lodash');
const readline = require('readline');

const getLocalExtensions = require('./helpers/get-local-extensions.js');
const configJsonPath = path.resolve('config.json');

function getIgnoreListForPath(folder) {
  const gitignorePatterns = parseGitignore(path.join(folder, '.gitignore'));
  const npmignorePatterns = parseGitignore(path.join(folder, '.npmignore'));
  return _.union(gitignorePatterns, npmignorePatterns, '.git');
}

function watchWorkingDirectories() {
  const config = fs.readJsonSync(configJsonPath);
  const localExtensions = getLocalExtensions(config.workingDirectories);
  localExtensions.forEach((extension) => {
    const packageName = extension.id;
    const packagePath = extension.path;
    const nodeModules = 'node_modules';
    const ignoreList = getIgnoreListForPath(packagePath);
    const installedExtensionPath = path.join(nodeModules, packageName);
    const shouldCopyFile = (filePath) =>
      !_.some(ignoreList, (ignorePath) =>
         globToRegExp(path.join(packagePath, ignorePath)).test(filePath)
      );
    console.log(`Watching: ${packageName}`);
    watch(packagePath, (filename) => {
      const localPath = path.relative(packagePath, filename);
      const destination = path.join(installedExtensionPath, localPath);
      if (shouldCopyFile(filename)) {
        console.log(`Copying ${filename} to ${destination}`);
        fs.copy(filename, destination, (copyError) => {
          if (copyError) {
            console.error(copyError);
          }
        });
      }
    });
  });
}

function supportGracefulShutdownOnWindows() {
  if (/^win/.test(process.platform)) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('SIGINT', function () {
      process.emit('SIGINT');
    });
  }

  process.on('SIGINT', function () {
    process.exit();
  });
}

// Initial watch for working directories
watchWorkingDirectories();
// adds SIGINT (CTRL+C) fix on windows
supportGracefulShutdownOnWindows();

// Watch changes on config.json and trigger build and re-watch for working directories
watch(configJsonPath, () => {
  console.error('config.json changed. You should rebuild the app!');
});
