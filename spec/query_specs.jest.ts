import Scanner from '../src/scanner';
import SqlQuery from '../src/sql_query';
import { each } from 'lodash-es';

class Case {
    name: string;
    got: string;
    expected: string;

    constructor(name: string, query: string, expected: string, fn: any) {
        this.name = name;
        this.expected = expected;
        let scanner = new Scanner(query);
        this.got = fn(query, scanner.toAST())
    }
}

describe("macros builder:", () => {
    let testCases = [
        new Case(
            "$rate",
            "$rate(countIf(Type = 200) AS from_good, countIf(Type != 200) AS from_bad) FROM requests",
            'SELECT t,' +
            ' from_good/runningDifference(t/1000) from_goodRate,' +
            ' from_bad/runningDifference(t/1000) from_badRate' +
            ' FROM (' +
            ' SELECT $timeSeries AS t,' +
            ' countIf(Type = 200) AS from_good,' +
            ' countIf(Type != 200) AS from_bad' +
            ' FROM requests' +
            ' WHERE $timeFilter' +
            ' GROUP BY t' +
            ' ORDER BY t)',
            SqlQuery.rate
        ),
        new Case(
            "$rate negative",
            "$rated(countIf(Type = 200) AS from_good, countIf(Type != 200) AS from_bad) FROM requests",
            '$rated(countIf(Type = 200) AS from_good, countIf(Type != 200) AS from_bad) FROM requests',
            SqlQuery.rate
        ),
        new Case(
            "$rateColumns",
            "$rateColumns((AppType = '' ? 'undefined' : AppType) from_type, sum(Hits) from_hits) " +
            " FROM table_all WHERE Event = 'request' AND (-1 IN ($template) OR col IN ($template)) HAVING hits > $interval",
            'SELECT t,' +
            ' arrayMap(a -> (a.1, a.2/runningDifference( t/1000 )), groupArr)' +
            ' FROM' +
            ' (SELECT t,' +
            ' groupArray((from_type, from_hits)) AS groupArr' +
            ' FROM (' +
            ' SELECT $timeSeries AS t,' +
            " (AppType = '' ? 'undefined' : AppType) from_type," +
            ' sum(Hits) from_hits' +
            ' FROM table_all' +
            ' WHERE $timeFilter' +
            " AND Event = 'request' AND (-1 IN ($template) OR col IN ($template))" +
            ' GROUP BY t, from_type' +
            ' HAVING hits > $interval' +
            ' ORDER BY t, from_type)' +
            ' GROUP BY t' +
            ' ORDER BY t)',
            SqlQuery.rateColumns
        ),
        new Case(
            "$columns",
            "$columns(from_OSName, count(*) c) FROM requests ANY INNER JOIN oses USING OS",
            'SELECT t,' +
            ' groupArray((from_OSName, c)) AS groupArr' +
            ' FROM (' +
            ' SELECT $timeSeries AS t,' +
            ' from_OSName,' +
            ' count(*) c' +
            ' FROM requests' +
            ' ANY INNER JOIN oses USING OS' +
            ' WHERE $timeFilter' +
            ' GROUP BY t,' +
            ' from_OSName' +
            ' ORDER BY t,' +
            ' from_OSName)' +
            ' GROUP BY t' +
            ' ORDER BY t',
            SqlQuery.columns
        ),
        new Case(
            "$perSecond",
            "$perSecond(from_total, from_amount) FROM requests",
            'SELECT t,' +
            ' if(runningDifference(max_0) < 0, nan, runningDifference(max_0) / runningDifference(t/1000)) AS max_0_Rate,' +
            ' if(runningDifference(max_1) < 0, nan, runningDifference(max_1) / runningDifference(t/1000)) AS max_1_Rate' +
            ' FROM (' +
            ' SELECT $timeSeries AS t,' +
            ' max(from_total) AS max_0,' +
            ' max(from_amount) AS max_1' +
            ' FROM requests' +
            ' WHERE $timeFilter' +
            ' GROUP BY t' +
            ' ORDER BY t)',
            SqlQuery.perSecond
        ),
        new Case(
            "$perSecondColumns",
            "$perSecondColumns(concat('test',type) AS from_alias, from_total) FROM requests WHERE type IN ('udp', 'tcp')",
            'SELECT t,' +
            ' groupArray((from_alias, max_0_Rate)) AS groupArr' +
            ' FROM (' +
            ' SELECT t,' +
            ' from_alias,' +
            ' if(runningDifference(max_0) < 0, nan, runningDifference(max_0) / runningDifference(t/1000)) AS max_0_Rate' +
            ' FROM (' +
            ' SELECT $timeSeries AS t,' +
            ' concat(\'test\', type) AS from_alias,' +
            ' max(from_total) AS max_0' +
            ' FROM requests' +
            ' WHERE $timeFilter' +
            ' AND type IN (\'udp\', \'tcp\')' +
            ' GROUP BY t, from_alias' +
            ' ORDER BY from_alias, t' +
            ')' +
            ')' +
            ' GROUP BY t' +
            ' ORDER BY t',
            SqlQuery.perSecondColumns
        )
    ];

    each(testCases, (tc) => {
        if (tc.got !== tc.expected) {
            console.log(tc.got);
            console.log(tc.expected)
        }
        describe(tc.name, () => {
            it("expects equality", () => {
                expect(tc.got).toEqual(tc.expected);
            });
        })
    });
});

