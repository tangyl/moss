import { command, flag } from 'cmd-ts';
import { getLockInfo, forceClearLock } from '../core/config';

export const lockInfoCommand = command({
  name: 'lock-info',
  description: 'Show current config lock information',
  args: {},
  handler: async () => {
    try {
      const lockInfo = await getLockInfo();
      
      if (lockInfo) {
        console.log('🔒 Current config lock information:');
        console.log(`   Process ID: ${lockInfo.pid}`);
        console.log(`   Timestamp: ${new Date(lockInfo.timestamp).toLocaleString()}`);
        console.log(`   Command: ${lockInfo.command}`);
        console.log(`   Working directory: ${lockInfo.cwd}`);
      } else {
        console.log('✅ No config lock currently active');
      }
    } catch (error) {
      console.error('❌ Failed to get lock information:', error);
    }
  },
});

export const clearLockCommand = command({
  name: 'clear-lock',
  description: 'Force clear config lock (use with caution)',
  args: {
    force: flag({
      long: 'force',
      short: 'f',
      description: 'Force clear without confirmation',
    }),
  },
  handler: async ({ force }) => {
    try {
      const lockInfo = await getLockInfo();
      
      if (!lockInfo) {
        console.log('✅ No config lock to clear');
        return;
      }
      
      if (!force) {
        console.log('⚠️ Warning: Force clearing lock may affect running processes');
        console.log('💡 Use --force option to skip confirmation');
        return;
      }
      
      await forceClearLock();
      console.log('✅ Lock cleared');
      
    } catch (error) {
      console.error('❌ Failed to clear lock:', error);
    }
  },
}); 