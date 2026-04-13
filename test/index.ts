import { expect } from 'chai';

import { program } from '../src/cli.ts';

describe('speclynx CLI', function () {
  it('should have correct name', function () {
    expect(program.name()).to.equal('speclynx');
  });

  it('should have overlay subcommand', function () {
    const overlay = program.commands.find((cmd) => cmd.name() === 'overlay');
    expect(overlay).to.not.be.undefined;
  });

  it('should have overlay apply subcommand', function () {
    const overlay = program.commands.find((cmd) => cmd.name() === 'overlay');
    const apply = overlay!.commands.find((cmd) => cmd.name() === 'apply');
    expect(apply).to.not.be.undefined;
  });
});
