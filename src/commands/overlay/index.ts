import { Command } from 'commander';

import apply from './apply/index.ts';

const command = new Command('overlay');

command.description('Overlay operations for API definitions');
command.addCommand(apply);

export default command;
