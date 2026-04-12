import { expect } from 'chai';

import { program } from '../src/cli.ts';

describe('speclynx CLI', function () {
  it('should have correct name', function () {
    expect(program.name()).to.equal('speclynx');
  });
});
