suite("DFA", () => {
  let ScopeResolver = require('../auth/scoperesolver');
  let dfa = require('../auth/dfa');
  let assert = require('assert');
  let _ = require('lodash');

  let testSortRoles = ({title, roleIds, sorted}) => {
    title = title || 'sortRolesForDFAGeneration(' + roleIds.join(',') + ')';
    test(title, () => {
      _.range(500).forEach(() => {
        let roles = roleIds.map(i => {return {roleId: i}});
        roles = dfa.sortRolesForDFAGeneration(roles).map(r => r.roleId);
        if (!_.isEqual(roles, sorted)) {
          console.log("Got: ");
          console.log(roles);
          console.log("Expected: ");
          console.log(sorted);
          assert(false, "Not sorted correctly");
        }
        // shuffle roleIds for next round
        roleIds = _.shuffle(roleIds);
      });
    });
  };

  testSortRoles({
    roleIds: [
      'test-12',
      'test-2',
      'test-11',
      'test-1',
      'test-1*',
      'test-13',
      'test-3',
      'test-10',
      'test-*',
    ],
    sorted: [
      'test-*',
      'test-1*',
      'test-1',
      'test-10',
      'test-11',
      'test-12',
      'test-13',
      'test-2',
      'test-3',
    ],
  });

  testSortRoles({
    roleIds: ['(', '*', ''],
    sorted: ['*', '', '('],
  });

  testSortRoles({
    roleIds: ['ab(', 'ab*', 'aa'],
    sorted: ['aa', 'ab*', 'ab('],
  });

  const sortedRoleIds = [
    '*', 'a*', 'a', 'aa', 'aaa', 'aab', 'ab', 'abb*', 'abb', 'abbc', 'ca',
    'caa', 'cab*', 'cab', 'cc*'
  ];
  testSortRoles({
    title:  'big list',
    roleIds:  _.shuffle(sortedRoleIds),
    sorted: sortedRoleIds
  });


  let testMergeScopeSets = (title, {scopesA, scopesB, expected}) => {
    test("mergeScopeSets (" + title + ")", () => {
      _.range(500).forEach(() => {
        let results = dfa.mergeScopeSets(
          dfa.sortScopesForMerge(scopesA),
          dfa.sortScopesForMerge(scopesB)
        );
        if (!_.isEqual(results, expected)) {
          console.log('expected:');
          console.log(expected);
          console.log('got:');
          console.log(results);
          assert(false, "Expected different result!");
        }
        // Shuffle for next round
        scopesA = _.shuffle(scopesA);
        scopesB = _.shuffle(scopesB);
      });
    });
  };

  testMergeScopeSets('simple sort', {
    scopesA: ['a', 'b', 'c'],
    scopesB: [],
    expected: ['a', 'b', 'c'],
  });

  testMergeScopeSets('simple sort w. star', {
    scopesA: ['a*', 'b', 'c'],
    scopesB: [],
    expected: ['a*', 'b', 'c'],
  });

  testMergeScopeSets('complex sort', {
    scopesA: [
      'assume:tr-0',
      'assume:tr-1',
      'assume:tr-10',
      'assume:tr-2',
      'assume:tr-3',
      'assume:tr-4',
      'assume:tr-5',
      'assume:tr-6',
      'assume:tr-7',
      'assume:tr-8',
      'assume:tr-9',
      'special-scope',
    ],
    scopesB: [],
    expected: [
      'assume:tr-0',
      'assume:tr-1',
      'assume:tr-10',
      'assume:tr-2',
      'assume:tr-3',
      'assume:tr-4',
      'assume:tr-5',
      'assume:tr-6',
      'assume:tr-7',
      'assume:tr-8',
      'assume:tr-9',
      'special-scope',
    ],
  });

  testMergeScopeSets('can normalize', {
    scopesA: ['b*', 'ab', 'aa', 'a', 'a*'],
    scopesB: [],
    expected: ['a*', 'b*'],
  });

  testMergeScopeSets('can normalize', {
    scopesA: ['b*', 'ab', 'aa', 'a*'],
    scopesB: [],
    expected: ['a*', 'b*'],
  });

  testMergeScopeSets('sanity check (1)', {
    scopesA: ['assume:tr-10','assume:tr-9','special-scope'],
    scopesB: [],
    expected: ['assume:tr-10','assume:tr-9','special-scope'],
  });

  testMergeScopeSets('sanity check (2)', {
    scopesA: [],
    scopesB: ['assume:tr-10','assume:tr-9','special-scope'],
    expected: ['assume:tr-10','assume:tr-9','special-scope'],
  });

  testMergeScopeSets('can normalize two', {
    scopesA: ['b*', 'ab', 'aa', 'a*', 'c', 'ca', 'da*'],
    scopesB: ['b*', 'ab', 'aa', 'a*', 'abc', 'ab*', 'ca', 'daa'],
    expected: ['a*', 'b*', 'c', 'ca', 'da*'],
  });


  let testBuildResolver = (title, {
    roleIds, scope, expected, skipShuffle, dump
  }) => {
    skipShuffle = true;
    let N = skipShuffle ? 1 : 50;
    test("buildResolver (" + title + ")", () => {
      for (let i = 0; i < N; i++) {
        let roles = roleIds.map(i => {return {roleId: i}});
        //console.time("buildResolver");
        let {resolver, sets} = dfa.buildResolver(_.shuffle(roles));
        //console.timeEnd("buildResolver");

        let results = [];
        let resolveSets = (i) => {
          sets[i].forEach(r => {
            if (typeof(r) === 'number') {
              resolveSets(r);
            } else {
              results.push(r.roleId);
            }
          });
        };
        resolveSets(resolver(scope));

        if (dump) {
          let rs = dfa.sortRolesForDFAGeneration(_.cloneDeep(roles));
          let sets = [[]];
          let state = dfa.generateDFA(rs, 0, rs.length, 0, sets, 0);

          console.log(JSON.stringify(state, null, 2));
          for(let i = 0; i < sets.length; i++) {
            let ids = sets[i].map(r => r.roleId || r);
            console.log("raw sets[" + i + "] = " + JSON.stringify(ids));
          }
          console.log("result: "  + resolver(scope));
        }

        if (_.xor(results, expected).length !== 0) {
          console.log('expected:');
          console.log(expected);
          console.log('got:');
          console.log(results);
          assert(false, "Expected different result!");
        }
        // shuffle for next round
        roleIds = _.shuffle(roleIds);
      }
    });
  };


  testBuildResolver('ab* matches ab, abc', {
    roleIds: ['a', 'ab', 'abc'],
    scope: 'assume:ab*',
    expected: ['ab','abc'],
  });

  testBuildResolver('a*, b*, c*', {
    roleIds: ['a*', 'b*', 'c*', 'd'],
    scope: 'assume:a*',
    expected: ['a*'],
  });

  testBuildResolver('a*, ab*, ac*, d', {
    roleIds: ['a*', 'ab*', 'ac*', 'd'],
    scope: 'assume:a*',
    expected: ['a*', 'ab*', 'ac*'],
  });


  testBuildResolver('a gets a*', {
    roleIds: ['ab*', 'a*'],
    scope: 'assume:a',
    expected: ['a*'],
  });


  testBuildResolver('ab gets ab*, a*', {
    roleIds: ['ab*', 'a*'],
    scope: 'assume:ab',
    expected: ['ab*', 'a*'],
  });

  testBuildResolver('a gets * and a', {
    roleIds: ['*', 'a*'],
    scope: 'assume:a',
    expected: ['*', 'a*'],
  });

  testBuildResolver('a*, b*, c*', {
    roleIds: ['a*', 'ab*', 'ac*', 'd'],
    scope: 'assume:ab',
    expected: ['a*', 'ab*'],
  });

  testBuildResolver('ab* matches a*', {
    roleIds: ['a*', 'aabc'],
    scope: 'assume:aa*',
    expected: ['a*','aabc'],
  });

  testBuildResolver('* get all', {
    roleIds: ['a', 'b', 'c'],
    scope: '*',
    expected: ['a', 'b', 'c'],
  });

  testBuildResolver('a* get all', {
    roleIds: ['a', 'b', 'c'],
    scope: 'a*',
    expected: ['a', 'b', 'c'],
  });

  testBuildResolver('assume* get all', {
    roleIds: ['a', 'b', 'c'],
    scope: 'assume*',
    expected: ['a', 'b', 'c'],
  });

  testBuildResolver('assume:* get all', {
    roleIds: ['a', 'b', 'c'],
    scope: 'assume:*',
    expected: ['a', 'b', 'c'],
  });

  testBuildResolver('assum* get all', {
    roleIds: ['a', 'b', 'c'],
    scope: 'assum*',
    expected: ['a', 'b', 'c'],
  });

  testBuildResolver('assume:a works', {
    roleIds: ['a', 'b', 'c'],
    scope: 'assume:a',
    expected: ['a'],
  });

  testBuildResolver('exact match ab', {
    roleIds: ['a', 'ab', 'abc'],
    scope: 'assume:ab',
    expected: ['ab'],
  });

  testBuildResolver('ab* matches ab, abc', {
    roleIds: ['a', 'ab', 'abc'],
    scope: 'assume:ab*',
    expected: ['ab','abc'],
  });

  testBuildResolver('ab* matches a*', {
    roleIds: ['a*', 'ab', 'abc'],
    scope: 'assume:ab*',
    expected: ['a*', 'ab','abc'],
  });

  testBuildResolver('ab match ab,a*', {
    roleIds: ['a*', 'ab', 'abc'],
    scope: 'assume:ab',
    expected: ['a*', 'ab'],
  });

  testBuildResolver('a*b* matches a*b, a*bc', {
    roleIds: ['a', 'a*b', 'a*bc', 'ab', 'abc', 'b*', 'c*', 'ab*'],
    scope: 'assume:a*b*',
    expected: ['a*b','a*bc'],
  });

  testBuildResolver('a*b matches a*, a*b', {
    roleIds: ['a*', 'a*b', 'a*bc', 'ab', 'abc', 'b*', 'c*', 'ab*'],
    scope: 'assume:a*b',
    expected: ['a*b','a*'],
  });

  testBuildResolver('a*b* matches a*b, a*bc', {
    roleIds: ['a*', 'a*b', 'a*bc', 'ab', 'abc', 'b*', 'c*', 'ab*'],
    scope: 'assume:a*b*',
    expected: ['a*b','a*bc', 'a*'],
  });

  testBuildResolver('try with 50', {
    roleIds: _.range(50).map(i => 't-' + i),
    scope: 'assume:t-1',
    expected: ['t-1'],
  });

  testBuildResolver('try with 500', {
    roleIds: _.range(500).map(i => 't-' + i),
    scope: 'assume:t-12*',
    expected: _.range(10).map(i => 't-12' + i).concat('t-12'),
    skipShuffle: true
  });

  testBuildResolver('try with 5000', {
    roleIds: _.range(5000).map(i => 't-' + i),
    scope: 'assume:t-122*',
    expected: _.range(10).map(i => 't-122' + i).concat('t-122'),
    skipShuffle: true
  });

  testBuildResolver('try with 5000 - exact match', {
    roleIds: _.range(5000).map(i => 't-' + i),
    scope: 'assume:t-1234',
    expected: ['t-1234'],
    skipShuffle: true
  });

return;

  let testFixedPointComputation = (title, {roles, scope, expected}) => {
    test(title, () => {
      let resolver = dfa.computeFixedPoint(roles);

      let results = resolver(scope);
      if (_.xor(results, expected).length !== 0) {
        console.log('expected:');
        console.log(expected);
        console.log('got:');
        console.log(results);
        assert(false, "Expected different result!");
      }
    });
  };

  testFixedPointComputation('* get all', {
    roles: [
      {
        roleId: 'client-id:root',
        scopes: ['*']
      }
    ],
    scope: '*',
    expected: ['*']
  });

  testFixedPointComputation('client-id:* get all', {
    roles: [
      {
        roleId: 'client-id:root',
        scopes: ['*']
      }
    ],
    scope: 'assume:client-id:*',
    expected: ['*']
  });

  testFixedPointComputation('client-id:root get all', {
    roles: [
      {
        roleId: 'client-id:root',
        scopes: ['*']
      }
    ],
    scope: 'assume:client-id:root',
    expected: ['*']
  });


  testFixedPointComputation('test with stupid', {
    roles: [
      {
        roleId: 'client-id:big-test-client',
        scopes: ['assume:test-role-0']
      }, {
        roleId: 'test-role-10',
        scopes: ['special-scope']
      }, {
        roleId: 'test-role-0',
        scopes: ['assume:test-role-2']
      }, {
        roleId: 'test-role-2',
        scopes: ['assume:test-role-10']
      },
    ],
    scope: 'assume:client-id:big-test-client',
    expected: [
      'special-scope',
      'assume:test-role-0',
      'assume:test-role-2',
      'assume:test-role-10'
    ]
  });

  const N = 500;
  testFixedPointComputation('test with N = ' + N, {
    roles: [
      {
        roleId: 'client-id:c',
        scopes: ['assume:tr-0']
      }, {
        roleId: 'tr-' + N,
        scopes: ['special-scope']
      }
    ].concat(_.range(N).map(i => {
      return {
        roleId: 'tr-' + i,
        scopes: ['assume:tr-' + (i + 1)]
      };
    })),
    scope: 'assume:client-id:c',
    expected: [
      'special-scope'
    ].concat(_.range(N + 1).map(i => 'assume:tr-' + i))
  });

  const M = 5;  // depth
  const K = 500; // multiplier
  testFixedPointComputation('test with depth = ' + M + " x " + K, {
    roles: _.flatten([
      _.flatten(_.range(K).map(k => {
        return _.flatten(_.range(M).map(m => {
          return {
            roleId: 'k-' + k + '-' + m,
            scopes: ['assume:k-' + k + '-' + (m + 1)]
          };
        }));
      })),
      _.range(K).map(k => {
        return {
          roleId: 'k-' + k + '-' + M,
          scopes: ['special-scope']
        };
      }),
      [{
        roleId: 'client-id:c',
        scopes: ['assume:k-2-0']
      }]
    ]),
    scope: 'assume:client-id:c',
    expected: [
      'special-scope'
    ].concat(_.range(M + 1).map(i => 'assume:k-2-' + i))
  });

  _.range(100).forEach(i => {
    const M = _.random(3, 7);
    const K = _.random(7, 100);
    let name = 'test with depth = ' + M + " x " + K + " (iteration: " + i + ")";
    testFixedPointComputation(name, {
      roles: _.shuffle(_.flatten([
        _.flatten(_.range(K).map(k => {
          return _.flatten(_.range(M).map(m => {
            return {
              roleId: 'k-' + k + '-' + m,
              scopes: ['assume:k-' + k + '-' + (m + 1)]
            };
          }));
        })),
        _.range(K).map(k => {
          return {
            roleId: 'k-' + k + '-' + M,
            scopes: ['special-scope']
          };
        }),
        [{
          roleId: 'client-id:c',
          scopes: ['assume:k-2-0']
        }]
      ])),
      scope: 'assume:client-id:c',
      expected: _.shuffle([
        'special-scope'
      ].concat(_.range(M + 1).map(i => 'assume:k-2-' + i)))
    });
  });

});