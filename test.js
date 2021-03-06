const chai = require('chai');
const should = chai.should();
const _ = require('lodash');

const bp = require('.');

describe('batch-points', function() {
    let _test_data;
    let bp_instance;

    const trigger = function() {
        let _callback;

        return {
            trigger: function() {
                _callback();
            },
            init: function(callback) {
                _callback = callback;
            }
        };
    };

    let update_interval = trigger();
    let write_interval = trigger();

    // this function is required (rather than using require() directly), so
    // that we can modify the data in one test and then get clean data again in
    // the next test
    let load_data_from_disk = function(filename) {
        const loaded_data = require(filename);
        return _.cloneDeep(loaded_data);
    };

    let publish = function() {
        let _last_batch = {};

        return {
            publish: function(batch_of_points) {
                _last_batch = batch_of_points;
            },
            last: function() {
                return _last_batch;
            }
        }
    }();

    let _now;

    beforeEach(function() {
        _now = 1607203251539;
    });

    const init = function(options) {
        const mock_app = {
            selfId: _test_data.self.split('.')[1],
            signalk: {
                retrieve: function() {
                    return _test_data;
                }
            }
        };
        bp_instance = bp(mock_app);

        if (!options) options = {};
        if (!options.filter_list_type) options.filter_list_type = 'exclude';
        if (!options.filter_list) options.filter_list = [];

        bp_instance.start({
            write_interval: write_interval.init,
            update_interval: update_interval.init,
            now: function() { return _now; },
            filter_list_type: options.filter_list_type,
            filter_list: options.filter_list
        }, publish.publish);
    };

    afterEach(function() {
        bp_instance.stop();
    });

    it('publish-data', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed.json');

        init();

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "environment.wind.speedApparent|test-source": [0]
            }
        });
    });

    it('publish-two-times', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed.json');

        init();

        // get data
        update_interval.trigger();
        // advance time
        _now++;
        // get data
        update_interval.trigger();

        // write
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539,
                1607203251540
            ],
            data: {
                "environment.wind.speedApparent|test-source": [0, 0]
            }
        });
    });

    it('publish-two-metrics', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed-angle.json');

        init();

        // get data
        update_interval.trigger();
        // advance time
        _now++;
        // get data
        update_interval.trigger();

        // write
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539,
                1607203251540
            ],
            data: {
                "environment.wind.speedApparent|test-source": [0, 0],
                "environment.wind.angleApparent|test-source": [1.9799, 1.9799]
            }
        });
    });

    it('changing-value', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed.json');

        init();

        // get data
        update_interval.trigger();
        // advance time
        _now++;
        // change wind speed
        _test_data.vessels[_test_data.self.split('.')[1]].environment.wind.speedApparent.value = 1.2;
        // get data
        update_interval.trigger();

        // write
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539,
                1607203251540
            ],
            data: {
                "environment.wind.speedApparent|test-source": [0, 1.2],
            }
        });
    });

    it('reset-batch-after-write', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed.json');

        init();

        // get data
        update_interval.trigger();

        // write
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539,
            ],
            data: {
                "environment.wind.speedApparent|test-source": [0],
            }
        });

        // write again, should be empty
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [],
            data: {}
        });
    });

    it('publish-data-with-object-values', function() {
        _test_data = load_data_from_disk('./test-navigation-position.json');

        init();

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "navigation.position.longitude|test-source": [-122.40],
                "navigation.position.latitude|test-source": [47.67]
            }
        });
    });

    it('include-nothing', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed-angle.json');

        init({
            filter_list_type: 'include',
            filter_list: []
        });

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                // TODO: is it right to have the time, even though everything
                // was filtered?
                1607203251539
            ],
            data: {
            }
        });
    });

    it('include-one-metric', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed-angle.json');

        init({
            filter_list_type: 'include',
            filter_list: ['environment.wind.speedApparent']
        });

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "environment.wind.speedApparent|test-source": [0],
            }
        });
    });

    it('exclude-one-metric', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed-angle.json');

        init({
            filter_list_type: 'exclude',
            filter_list: ['environment.wind.speedApparent']
        });

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "environment.wind.angleApparent|test-source": [1.9799]
            }
        });
    });

    it('glob-include', function() {
        _test_data = load_data_from_disk('./test-environment-and-navigation.json');

        init({
            filter_list_type: 'include',
            filter_list: ['environment.*']
        });

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "environment.wind.speedApparent|test-source": [0],
                "environment.wind.angleApparent|test-source": [1.9799]
            }
        });
    });

    it('glob-exclude', function() {
        _test_data = load_data_from_disk('./test-environment-and-navigation.json');

        init({
            filter_list_type: 'exclude',
            filter_list: ['environment.*']
        });

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "navigation.speedThroughWater|test-source": [0],
            }
        });
    });

    it('two-sources', function() {
        _test_data = load_data_from_disk('./test-apparent-wind-speed-two-sources.json');

        init();

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "environment.wind.speedApparent|test-source-1": [0],
                "environment.wind.speedApparent|test-source-2": [0.5]
            }
        });
    });

    it('two-sources-object-value', function() {
        _test_data = load_data_from_disk('./test-navigation-position-two-sources.json');

        init();

        update_interval.trigger();
        write_interval.trigger();

        publish.last().should.deep.equal({
            header: [
                1607203251539
            ],
            data: {
                "navigation.position.longitude|test-source-1": [-122.40],
                "navigation.position.latitude|test-source-1": [47.67],
                "navigation.position.longitude|test-source-2": [-122.50],
                "navigation.position.latitude|test-source-2": [47.68]
            }
        });
    });
});
