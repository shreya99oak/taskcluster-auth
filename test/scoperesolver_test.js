suite('scoperesolver', () => {
  let ScopeResolver = require('../src/scoperesolver');
  let {mergeScopeSets, scopeCompare} = require('taskcluster-lib-scopes');
  let assert = require('assert');
  let _ = require('lodash');
  let fs = require('fs');

  suite('buildResolver', function() {
    const scopeResolver = new ScopeResolver();
    const makeResolver = roles => scopeResolver.buildResolver(roles);
    const testResolver = (title, {roles, scopes, expected}) => {
      test(title, function() {
        const resolver = makeResolver(roles);
        expected.sort(scopeCompare);
        assert.deepEqual(expected, resolver(scopes));
      });
    };

    testResolver('scopes pass through', {
      roles: [],
      scopes: ['a', 'b', 'c*'],
      expected: ['a', 'b', 'c*'],
    });

    testResolver('passed through scopes are normalized', {
      roles: [],
      scopes: ['a*', 'ab', 'ac*', 'a'],
      expected: ['a*'],
    });

    testResolver('role with * gets everything', {
      roles: [
        {roleId: 'client-id:root', scopes: ['*']},
      ],
      scopes: ['assume:client-id:root'],
      expected: ['*'],
    });

    testResolver('role with *, matched with *, gets everything', {
      roles: [
        {roleId: 'client-id:root', scopes: ['*']},
      ],
      scopes: ['assume:client-id:*'],
      expected: ['*'],
    });

    testResolver('assume:a* matches, a, aa, ab, a*', {
      roles: [
        {roleId: 'a', scopes: ['A']},
        {roleId: 'aa', scopes: ['AA']},
        {roleId: 'ab', scopes: ['AB']},
        {roleId: 'a*', scopes: ['ASTAR']},
      ],
      scopes: ['assume:a*'],
      expected: ['assume:a*', 'A', 'AA', 'AB', 'ASTAR'],
    });

    testResolver('ab* matches ab, abc', {
      roles: [
        {roleId: 'a', scopes: ['A']},
        {roleId: 'ab', scopes: ['AB']},
        {roleId: 'abc', scopes: ['ABC']},
      ],
      scopes: ['assume:ab*'],
      expected: ['assume:ab*', 'AB', 'ABC'],
    });

    testResolver('a gets a*', {
      roles: [
        {roleId: 'a*', scopes: ['ASTAR']},
        {roleId: 'ab*', scopes: ['ABSTAR']},
      ],
      scopes: ['assume:a'],
      expected: ['assume:a', 'ASTAR'],
    });

    testResolver('max sets (with long scopes)', {
      roles: [
        {roleId: 'ab*', scopes: ['ABSTAR']},
        {roleId: 'aaaaaaaaaaaaa', scopes: ['long']},
        {roleId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', scopes: ['longer']},
        {roleId: 'ababaabdssafsdcsdcsacwscwcscsesdsdfdsfdsfsdfsfdsdfsdfsdfsafewfsewfwsd', scopes: ['longest']},
      ],
      scopes: ['assume:ab*'],
      expected: ['assume:ab*', 'ABSTAR', 'longest'],
    });

    testResolver('ab gets ab*, a*', {
      roles: [
        {roleId: 'ab*', scopes:['ABSTAR']},
        {roleId: 'a*', scopes:['ASTAR']},
      ],
      scopes: ['assume:ab'],
      expected: ['assume:ab', 'ABSTAR', 'ASTAR'],
    });

    testResolver('a gets * and a', {
      roles: [
        {roleId: '*', scopes:['STAR']},
        {roleId: 'a*', scopes:['ASTAR']},
      ],
      scopes: ['assume:a'],
      expected: ['assume:a', 'STAR', 'ASTAR'],
    });

    testResolver('a*, b*, c*', {
      roles: [
        {roleId: 'a*', scopes:['ASTAR']},
        {roleId: 'ab*', scopes:['ABSTAR']},
        {roleId: 'ac*', scopes:['ACSTAR']},
        {roleId: 'd', scopes:['D']},
      ],
      scopes: ['assume:ab'],
      expected: ['assume:ab', 'ASTAR', 'ABSTAR'],
    });

    testResolver('ab* matches a*', {
      roles: [
        {roleId: 'a*', scopes:['ASTAR']},
        {roleId: 'aabc', scopes:['AABC']},
      ],
      scopes: ['assume:aa*'],
      expected: ['assume:aa*', 'ASTAR', 'AABC'],
    });

    testResolver('* get all', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'b', scopes:['B']},
        {roleId: 'c', scopes:['C']},
      ],
      scopes: ['*'],
      expected: ['*'],
    });

    testResolver('a* get all', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'b', scopes:['B']},
        {roleId: 'c', scopes:['C']},
      ],
      scopes: ['a*'],
      expected: ['a*', 'A', 'B', 'C'],
    });

    testResolver('assume* get all', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'b', scopes:['B']},
        {roleId: 'c', scopes:['C']},
      ],
      scopes: ['assume*'],
      expected: ['assume*', 'A', 'B', 'C'],
    });

    testResolver('assume:* get all', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'b', scopes:['B']},
        {roleId: 'c', scopes:['C']},
      ],
      scopes: ['assume:*'],
      expected: ['assume:*', 'A', 'B', 'C'],
    });

    testResolver('assum* get all', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'b', scopes:['B']},
        {roleId: 'c', scopes:['C']},
      ],
      scopes: ['assum*'],
      expected: ['assum*', 'A', 'B', 'C'],
    });

    testResolver('assume:a works', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'b', scopes:['B']},
        {roleId: 'c', scopes:['C']},
      ],
      scopes: ['assume:a'],
      expected: ['assume:a', 'A'],
    });

    testResolver('exact match ab', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'ab', scopes:['AB']},
        {roleId: 'abc', scopes:['ABC']},
      ],
      scopes: ['assume:ab'],
      expected: ['assume:ab', 'AB'],
    });

    testResolver('ab* matches ab, abc', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'ab', scopes:['AB']},
        {roleId: 'abc', scopes:['ABC']},
      ],
      scopes: ['assume:ab*'],
      expected: ['assume:ab*', 'AB', 'ABC'],
    });

    testResolver('ab* matches a*', {
      roles: [
        {roleId: 'a*', scopes:['ASTAR']},
        {roleId: 'ab', scopes:['AB']},
        {roleId: 'abc', scopes:['ABC']},
      ],
      scopes: ['assume:ab*'],
      expected: ['assume:ab*', 'ASTAR', 'AB', 'ABC'],
    });

    testResolver('ab match ab,a*', {
      roles: [
        {roleId: 'a*', scopes:['ASTAR']},
        {roleId: 'ab', scopes:['AB']},
        {roleId: 'abc', scopes:['ABC']},
      ],
      scopes: ['assume:ab'],
      expected: ['assume:ab', 'ASTAR', 'AB'],
    });

    testResolver('a*b* matches a*b, a*bc', {
      roles: [
        {roleId: 'a', scopes:['A']},
        {roleId: 'a*b', scopes:['ASTARB']},
        {roleId: 'a*bc', scopes:['ASTARBC']},
        {roleId: 'ab', scopes:['AB']},
        {roleId: 'abc', scopes:['ABC']},
        {roleId: 'b*', scopes:['BSTAR']},
        {roleId: 'c*', scopes:['CSTAR']},
        {roleId: 'ab*', scopes:['ABSTAR']},
      ],
      scopes: ['assume:a*b*'],
      expected: ['assume:a*b*', 'ASTARB', 'ASTARBC'],
    });

    testResolver('a*b matches a*, a*b', {
      roles: [
        {roleId: 'a*', scopes:['ASTAR']},
        {roleId: 'a*b', scopes:['ASTARB']},
        {roleId: 'a*bc', scopes:['ASTARBC']},
        {roleId: 'ab', scopes:['AB']},
        {roleId: 'abc', scopes:['ABC']},
        {roleId: 'b*', scopes:['BSTAR']},
        {roleId: 'c*', scopes:['CSTAR']},
        {roleId: 'ab*', scopes:['ABSTAR']},
      ],
      scopes: ['assume:a*b'],
      expected: ['assume:a*b', 'ASTARB', 'ASTAR'],
    });

    testResolver('a*b* matches a*b, a*bc', {
      roles: [
        {roleId: 'a*', scopes:['ASTAR']},
        {roleId: 'a*b', scopes:['ASTARB']},
        {roleId: 'a*bc', scopes:['ASTARBC']},
        {roleId: 'ab', scopes:['AB']},
        {roleId: 'abc', scopes:['ABC']},
        {roleId: 'b*', scopes:['BSTAR']},
        {roleId: 'c*', scopes:['CSTAR']},
        {roleId: 'ab*', scopes:['ABSTAR']},
      ],
      scopes: ['assume:a*b*'],
      expected: ['assume:a*b*', 'ASTARB', 'ASTARBC', 'ASTAR'],
    });
  });

  suite('performance', function() {
    const scopeResolver = new ScopeResolver();
    const makeResolver = roles => scopeResolver.buildResolver(roles);
    const shouldMeasure = process.env.MEASURE_PERFORMANCE;
    const measureN = 50;
    const measureSkip = 5; // initial runs to skip (allows JIT warmup)
    const timings = [];

    const testResolver = (title, {roles, scopes, expected}) => {
      test(title, function() {
        let timing, time;
        if (shouldMeasure) {
          // this could take a while..
          this.slow(3600000);
          this.timeout(0);

          timing = {title};
          timings.push(timing);
          time = (step, fn) => {
            let result;
            timing[step] = [];
            for (let i = 0; i < measureN; i++) {
              const start = process.hrtime();
              result = fn();
              const took = process.hrtime(start);
              timing[step].push(took[0] * 1000000000 + took[1]);
            }
            timing[step].splice(0, measureSkip);
            let mean = _.reduce(timing[step], (a, b) => a + b) / timing[step].length;
            let unit = 'ns';
            if (mean > 1000) {
              mean /= 1000;
              unit = 'μs';
            }
            if (mean > 1000) {
              mean /= 1000;
              unit = 'ms';
            }
            console.log(`${step}: ${mean.toFixed(2)} ${unit}`);
            return result;
          };
        } else {
          time = (step, fn) => fn();
        }

        let resolver = time('setup', () => makeResolver(roles));
        let result = time('execute', () => resolver(scopes));
        if (expected) {
          expected.sort(scopeCompare);
          assert.deepEqual(expected, resolver(scopes));
        }
      });
    };

    suiteTeardown(function() {
      if (!shouldMeasure) {
        return;
      }

      fs.writeFileSync('timings.json', JSON.stringify(timings, null, 2));
      console.log('timings written to timings.json');
    });

    // test a chain of N roles, each one leading to the next
    // ch-1 -> ... -> assume:ch-N -> special-scope
    const testChain = N => {
      testResolver(`chain of ${N} roles`, {
        roles: _.range(N).map(i => ({roleId: `ch-${i}`, scopes: [`assume:ch-${i+1}`]})).concat([
          {roleId: `ch-${N}`, scopes: ['special-scope']},
        ]),
        scopes: ['assume:ch-0'],
        expected: _.range(N).map(i => `assume:ch-${i}`).concat([
          `assume:ch-${N}`,
          'special-scope',
        ]),
      });
    };
    testChain(500);
    if (shouldMeasure) {
      testChain(750);
      testChain(1000);
      testChain(1250);
      testChain(1500);
    }

    // test a tree of roles H roles deep, with each row growing by W
    // t ---> t-1 ---> t-1-1 ---> ... t-1-1-1-1-1
    //        t-2 ..   t-1-2            \---H---/
    //        ..       ..
    //        t-W ..
    const testTree = (W, H) => {
      const roles = [];
      const recur = (prefix, h) => {
        const roleIds = _.range(W).map(w => `${prefix}-${w}`);
        if (h != H) {
          roleIds.forEach(roleId => recur(roleId, h+1));
        }
        roles.push({
          roleId: prefix,
          scopes: roleIds.map(roleId => `assume:${roleId}`),
        });
      };
      recur('t', 0);

      testResolver(`tree of ${W}x${H} roles`, {
        roles,
        scopes: ['assume:t'],
        expected: _.flatten(roles.map(r => r.scopes)).concat(['assume:t']),
      });
    };
    testTree(2, 3);
    if (shouldMeasure) {
      testTree(1, 4);
      testTree(2, 4);
      testTree(2, 5);
      testTree(2, 6);
      testTree(3, 3);
      testTree(3, 4);
      testTree(3, 5);
      testTree(4, 4);
    }

    // Test with a snapshot of real roles, captured with
    //   `curl https://auth.taskcluster.net/v1/roles`
    const realRoles = require('./roles');
    const testRealRoles = (scopes, expected) => {
      testResolver(`real roles with scopes ${scopes.join(', ')}`, {
        roles: realRoles,
        scopes,
        expected,
      });
    };

    testRealRoles(['assume:*'], [
      'assume:*',
      'auth:*',
      'aws-provisioner:*',
      'docker-worker:*',
      'ec2-manager:*',
      'generic-worker:*',
      'github:*',
      'hooks:*',
      'index:*',
      'notify:*',
      'project:*',
      'pulse:*',
      'purge-cache:*',
      'queue:*',
      'scheduler:*',
      'secrets:*',
    ]);

    testRealRoles(['assume:repo:github.com/*']);
    testRealRoles(['assume:worker-type:*']);
    testRealRoles(['assume:mozilla-user:*']);
    testRealRoles(['assume:mozilla-group:team_taskcluster']);
    testRealRoles(['assume:moz-tree:level:3']);
  });

  suite('normalizeScopes', () => {
    // Test cases for normalizeScopes
    [
      {
        scopes:   ['*'],
        result:   ['*'],
      }, {
        scopes:   ['*', 'test'],
        result:   ['*'],
      }, {
        scopes:   ['*', 'test', 'te*'],
        result:   ['*'],
      }, {
        scopes:   ['*', 'te*'],
        result:   ['*'],
      }, {
        scopes:   ['test*', 't*'],
        result:   ['t*'],
      }, {
        scopes:   ['test*', 'ab*'],
        result:   ['test*', 'ab*'],
      }, {
        scopes:   ['abc', 'ab*', 'a', 'ab'],
        result:   ['ab*', 'a'],
      }, {
        scopes:   ['a', 'b', 'c'],
        result:   ['a', 'b', 'c'],
      }, {
        scopes:   ['ab', 'a', 'abc*'],
        result:   ['ab', 'a', 'abc*'],
      }, {
        scopes:   ['a*', 'ab', 'a', 'abc*'],
        result:   ['a*'],
      },
    ].forEach(({scopes, result}) => {
      test(`normalizeScopes(${scopes.join(', ')})`, () => {
        if (_.xor(ScopeResolver.normalizeScopes(scopes), result).length !== 0) {
          console.error('Expected: ');
          console.error(result);
          console.error('Got: ');
          console.error(ScopeResolver.normalizeScopes(scopes));
          assert(false, 'Expected normalizeScopes(' + scopes.join(', ') +
                        ') === ' + result.join(', '));
        }
      });
    });
  });
});
