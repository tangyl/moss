import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ConfigLock {
  private lockFilePath: string;
  private lockFileHandle: fs.promises.FileHandle | null = null;
  private pid: number;

  constructor(configDir: string) {
    this.lockFilePath = path.join(configDir, '.moss.lock');
    this.pid = process.pid;
  }

  /**
   * Try to acquire configuration lock
   * @param timeout Timeout in milliseconds, default 5000ms
   * @returns Promise<boolean> Whether lock was successfully acquired
   */
  async acquireLock(timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Try to create lock file with exclusive mode
        this.lockFileHandle = await fs.promises.open(this.lockFilePath, 'wx');
        
        // Write current process ID
        const lockData = {
          pid: this.pid,
          timestamp: Date.now(),
          command: process.argv.join(' '),
          cwd: process.cwd()
        };
        
        await this.lockFileHandle.writeFile(JSON.stringify(lockData, null, 2));
        await this.lockFileHandle.sync(); // Ensure data is written to disk
        
        return true;
        
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock file already exists, check if it's a deadlock
          try {
            const lockContent = await fs.promises.readFile(this.lockFilePath, 'utf8');
            const lockData = JSON.parse(lockContent);
            
            // Check if process is still running
            if (await this.isProcessRunning(lockData.pid)) {
              // Process is still running, wait a bit and retry
              await this.sleep(100);
              continue;
            } else {
              // Process is dead, delete lock file and retry
              await fs.promises.unlink(this.lockFilePath);
              continue;
            }
          } catch (readError) {
            // Cannot read lock file, might be corrupted, delete and retry
            try {
              await fs.promises.unlink(this.lockFilePath);
            } catch (unlinkError) {
              // Ignore delete errors
            }
            continue;
          }
        } else {
          throw error;
        }
      }
    }
    
    // Timeout
    throw new Error(`Failed to acquire config lock (${timeout}ms). Another process might be using the same configuration.`);
  }

  /**
   * Release configuration lock
   */
  async releaseLock(): Promise<void> {
    if (this.lockFileHandle) {
      try {
        await this.lockFileHandle.close();
        await fs.promises.unlink(this.lockFilePath);
      } catch (error) {
        // Silently handle errors
      } finally {
        this.lockFileHandle = null;
      }
    }
  }

  /**
   * Check if process is still running
   */
  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Use kill -0 to check process on Unix systems
      if (os.platform() !== 'win32') {
        process.kill(pid, 0);
        return true;
      } else {
        // Use tasklist to check on Windows systems
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        try {
          await execAsync(`tasklist /FI "PID eq ${pid}" 2>NUL | find /I "${pid}" >NUL`);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * Sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current lock information
   */
  async getLockInfo(): Promise<any | null> {
    try {
      if (fs.existsSync(this.lockFilePath)) {
        const lockContent = await fs.promises.readFile(this.lockFilePath, 'utf8');
        return JSON.parse(lockContent);
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }
}

/**
 * Config lock decorator for automatic lock lifecycle management
 */
export function withConfigLock<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  timeout: number = 5000
) {
  return async (...args: T): Promise<R> => {
    const { getConfig } = require('./config');
    const config = getConfig();
    const lock = new ConfigLock(config.configDir);
    
    try {
      await lock.acquireLock(timeout);
      return await fn(...args);
    } finally {
      await lock.releaseLock();
    }
  };
} 