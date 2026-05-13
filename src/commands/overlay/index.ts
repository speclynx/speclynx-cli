import { Command } from 'commander';

import apply from './apply/index.ts';
import diff from './diff/index.ts';

const command = new Command('overlay');

command.description('Overlay operations for API definitions');
command.addCommand(apply);
command.addCommand(diff);

export default command;
