import fs from 'fs';
import path from 'path';

import { matchTriggerHits, tokenizeText } from '../trigger-matcher';

interface TriggerMatrixCase {
  name: string;
  triggers: string[];
  message: string;
  expectedHits: string[];
}

const matrixPath = path.resolve(
  __dirname,
  '../../../../../../../apps/api/tests/fixtures/skills-trigger-matrix.json',
);

const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as {
  cases: TriggerMatrixCase[];
};

describe('trigger matcher parity matrix (shared with apps/api tests)', () => {
  const cases = matrix.cases.map(
    (testCase) => [testCase.name, testCase] as [string, TriggerMatrixCase],
  );

  it.each(cases)('%s', (_name, testCase) => {
    expect(matchTriggerHits(testCase.triggers, testCase.message)).toEqual(testCase.expectedHits);
  });

  it('loads a non-empty matrix so the parity suite cannot silently pass on nothing', () => {
    expect(matrix.cases.length).toBeGreaterThanOrEqual(15);
  });

  it('tokenizes the same way as the backend _tokenize', () => {
    expect(tokenizeText("Hello, world! -- it's fine.")).toEqual([
      'hello',
      'world',
      'it',
      's',
      'fine',
    ]);
    expect(tokenizeText('')).toEqual([]);
    expect(tokenizeText('///')).toEqual([]);
  });
});
