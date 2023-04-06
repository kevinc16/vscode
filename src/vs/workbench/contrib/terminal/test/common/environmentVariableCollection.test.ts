/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, strictEqual } from 'assert';
import { EnvironmentVariableMutatorType } from 'vs/platform/terminal/common/environmentVariable';
import { IProcessEnvironment, isWindows } from 'vs/base/common/platform';
import { MergedEnvironmentVariableCollection } from 'vs/platform/terminal/common/environmentVariableCollection';
import { deserializeEnvironmentVariableCollection } from 'vs/platform/terminal/common/environmentVariableShared';

suite('EnvironmentVariable - MergedEnvironmentVariableCollection', () => {
	suite('ctor', () => {
		test('Should keep entries that come after a Prepend or Append type mutators', () => {
			const merged = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}],
				['ext2', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a2', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}],
				['ext3', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a3', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}],
				['ext4', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a4', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}]
			]), undefined);
			deepStrictEqual([...merged.map.entries()], [
				['A', [
					{ extensionIdentifier: 'ext4', type: EnvironmentVariableMutatorType.Append, value: 'a4' },
					{ extensionIdentifier: 'ext3', type: EnvironmentVariableMutatorType.Prepend, value: 'a3' },
					{ extensionIdentifier: 'ext2', type: EnvironmentVariableMutatorType.Append, value: 'a2' },
					{ extensionIdentifier: 'ext1', type: EnvironmentVariableMutatorType.Prepend, value: 'a1' }
				]]
			]);
		});

		test('Should remove entries that come after a Replace type mutator', () => {
			const merged = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}],
				['ext2', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a2', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}],
				['ext3', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a3', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}],
				['ext4', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a4', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}]
			]), undefined);
			deepStrictEqual([...merged.map.entries()], [
				['A', [
					{ extensionIdentifier: 'ext3', type: EnvironmentVariableMutatorType.Replace, value: 'a3' },
					{ extensionIdentifier: 'ext2', type: EnvironmentVariableMutatorType.Append, value: 'a2' },
					{ extensionIdentifier: 'ext1', type: EnvironmentVariableMutatorType.Prepend, value: 'a1' }
				]]
			], 'The ext4 entry should be removed as it comes after a Replace');
		});
	});

	suite('applyToProcessEnvironment', () => {
		test('should apply the collection to an environment', async () => {
			const merged = new MergedEnvironmentVariableCollection(new Map([
				['ext', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['B', { value: 'b', type: EnvironmentVariableMutatorType.Append, scope: undefined }],
						['C', { value: 'c', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}]
			]), undefined);
			const env: IProcessEnvironment = {
				A: 'foo',
				B: 'bar',
				C: 'baz'
			};
			await merged.applyToProcessEnvironment(env);
			deepStrictEqual(env, {
				A: 'a',
				B: 'barb',
				C: 'cbaz'
			});
		});

		test('should apply the collection to environment entries with no values', async () => {
			const merged = new MergedEnvironmentVariableCollection(new Map([
				['ext', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['B', { value: 'b', type: EnvironmentVariableMutatorType.Append, scope: undefined }],
						['C', { value: 'c', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}]
			]), undefined);
			const env: IProcessEnvironment = {};
			await merged.applyToProcessEnvironment(env);
			deepStrictEqual(env, {
				A: 'a',
				B: 'b',
				C: 'c'
			});
		});

		test('should apply to variable case insensitively on Windows only', async () => {
			const merged = new MergedEnvironmentVariableCollection(new Map([
				['ext', {
					map: deserializeEnvironmentVariableCollection([
						['a', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['b', { value: 'b', type: EnvironmentVariableMutatorType.Append, scope: undefined }],
						['c', { value: 'c', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}]
			]), undefined);
			const env: IProcessEnvironment = {
				A: 'A',
				B: 'B',
				C: 'C'
			};
			await merged.applyToProcessEnvironment(env);
			if (isWindows) {
				deepStrictEqual(env, {
					A: 'a',
					B: 'Bb',
					C: 'cC'
				});
			} else {
				deepStrictEqual(env, {
					a: 'a',
					A: 'A',
					b: 'b',
					B: 'B',
					c: 'c',
					C: 'C'
				});
			}
		});
	});

	suite('diff', () => {
		test('should return undefined when collectinos are the same', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const merged2 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged2);
			strictEqual(diff, undefined);
		});
		test('should generate added diffs from when the first entry is added', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([]), undefined);
			const merged2 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged2)!;
			strictEqual(diff.changed.size, 0);
			strictEqual(diff.removed.size, 0);
			const entries = [...diff.added.entries()];
			deepStrictEqual(entries, [
				['A', [{ extensionIdentifier: 'ext1', value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]]
			]);
		});

		test('should generate added diffs from the same extension', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const merged2 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['B', { value: 'b', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged2)!;
			strictEqual(diff.changed.size, 0);
			strictEqual(diff.removed.size, 0);
			const entries = [...diff.added.entries()];
			deepStrictEqual(entries, [
				['B', [{ extensionIdentifier: 'ext1', value: 'b', type: EnvironmentVariableMutatorType.Append, scope: undefined }]]
			]);
		});

		test('should generate added diffs from a different extension', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}]
			]), undefined);

			const merged2 = new MergedEnvironmentVariableCollection(new Map([
				['ext2', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a2', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}],
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged2)!;
			strictEqual(diff.changed.size, 0);
			strictEqual(diff.removed.size, 0);
			deepStrictEqual([...diff.added.entries()], [
				['A', [{ extensionIdentifier: 'ext2', value: 'a2', type: EnvironmentVariableMutatorType.Append, scope: undefined }]]
			]);

			const merged3 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}],
				// This entry should get removed
				['ext2', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a2', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}]
			]), undefined);
			const diff2 = merged1.diff(merged3)!;
			strictEqual(diff2.changed.size, 0);
			strictEqual(diff2.removed.size, 0);
			deepStrictEqual([...diff.added.entries()], [...diff2.added.entries()], 'Swapping the order of the entries in the other collection should yield the same result');
		});

		test('should remove entries in the diff that come after a Replace', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const merged4 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}],
				// This entry should get removed as it comes after a replace
				['ext2', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a2', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged4);
			strictEqual(diff, undefined, 'Replace should ignore any entries after it');
		});

		test('should generate removed diffs', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['B', { value: 'b', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const merged2 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged2)!;
			strictEqual(diff.changed.size, 0);
			strictEqual(diff.added.size, 0);
			deepStrictEqual([...diff.removed.entries()], [
				['B', [{ extensionIdentifier: 'ext1', value: 'b', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]]
			]);
		});

		test('should generate changed diffs', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['B', { value: 'b', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]
					])
				}]
			]), undefined);
			const merged2 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a2', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['B', { value: 'b', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged2)!;
			strictEqual(diff.added.size, 0);
			strictEqual(diff.removed.size, 0);
			deepStrictEqual([...diff.changed.entries()], [
				['A', [{ extensionIdentifier: 'ext1', value: 'a2', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]],
				['B', [{ extensionIdentifier: 'ext1', value: 'b', type: EnvironmentVariableMutatorType.Append, scope: undefined }]]
			]);
		});

		test('should generate diffs with added, changed and removed', () => {
			const merged1 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a1', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['B', { value: 'b', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]
					])
				}]
			]), undefined);
			const merged2 = new MergedEnvironmentVariableCollection(new Map([
				['ext1', {
					map: deserializeEnvironmentVariableCollection([
						['A', { value: 'a2', type: EnvironmentVariableMutatorType.Replace, scope: undefined }],
						['C', { value: 'c', type: EnvironmentVariableMutatorType.Append, scope: undefined }]
					])
				}]
			]), undefined);
			const diff = merged1.diff(merged2)!;
			deepStrictEqual([...diff.added.entries()], [
				['C', [{ extensionIdentifier: 'ext1', value: 'c', type: EnvironmentVariableMutatorType.Append, scope: undefined }]],
			]);
			deepStrictEqual([...diff.removed.entries()], [
				['B', [{ extensionIdentifier: 'ext1', value: 'b', type: EnvironmentVariableMutatorType.Prepend, scope: undefined }]]
			]);
			deepStrictEqual([...diff.changed.entries()], [
				['A', [{ extensionIdentifier: 'ext1', value: 'a2', type: EnvironmentVariableMutatorType.Replace, scope: undefined }]]
			]);
		});
	});
});
