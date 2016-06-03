import _ from 'underscore';
import gutils from 'gulp-util';
import map from 'vinyl-map';
import minifier from './utilities/minifier';

class Task {

    /**
     * Create a new Task instance.
     *
     * @param {string}    name
     * @param {Function}  description
     * @param {GulpPaths} paths
     */
    constructor(name, description, paths) {
        this.name = name;
        this.watchers = [];
        this.isComplete = false;
        this.steps = [];

        if (paths) {
            this.paths = paths;
            this.src = this.paths.src;
            this.output = this.paths.output;
        }

        // If the user opted for a subclass that contains
        // a "gulpTask" method, we will then defer to
        // that for all Gulp-specific logic.
        if (this.gulpTask) {
            this.describe(this.gulpTask);
        } else if (description) {
            this.describe(description);
        }
    }


    /**
     * Get the "ucwords" version of the task name.
     */
    ucName() {
        return this.name.substr(0,1).toUpperCase() + this.name.substr(1);
    }


    /**
     * Describe the task. This is the Gulp definition.
     *
     * @param  {Function} definition
     * @return {Task}
     */
    describe(definition) {
        this.definition = definition;

        return this.register();
    }


    /**
     * Set the task to be called, when firing `Gulp`.
     *
     * @return {Task}
     */
    register() {
        Elixir.tasks.push(this);

        return this;
    }


    /**
     * Set a path regex to watch for changes.
     *
     * @param  {string}      regex
     * @param  {string|null} category
     * @return {Task}
     */
    watch(regex, category) {
        if (regex) {
            this.watchers = this.watchers.concat(regex);
        }

        this.category = category || 'default';

        return this;
    }


    /**
     * Determine if the task has any watchers.
     */
    hasWatchers() {
        return this.watchers.length > 0;
    }


    /**
     * Exclude the given path from the watcher.
     *
     * @param  {string} path
     * @return {Task}
     */
    ignore(path) {
        this.watchers.push(('!./' + path).replace('././', './'));

        return this;
    }


    /**
     * Execute the task definition.
     */
    run() {
        this.registerWatchers && this.registerWatchers();

        let definition = this.definition(Elixir.Plugins, Elixir.config);

        this.isComplete = true;

        this.log();

        return definition;
    }


    /**
     * An ordered list of the actions that occurred for the task.
     *
     * @returns {string}
     */
    summary() {
        return this.steps.map((step, index) => `${++index}. ${step}`).join('\n');
    }


    /**
     * Initialize the sourcemaps.
     */
    initSourceMaps() {
        if (! Elixir.config.sourcemaps) {
            return map(function () {});
        }

        return Elixir.Plugins.sourcemaps.init();
    }


    /**
     * Write to the sourcemaps file.
     */
    writeSourceMaps() {
        if (! Elixir.config.sourcemaps) {
            return map(function () {});
        }

        this.recordStep('Writing Source Maps');

        return Elixir.Plugins.sourcemaps.write('.');

    }


    /**
     * Apply CSS auto-prefixing.
     */
    autoPrefix() {
        if (! Elixir.config.css.autoprefix.enabled) {
            return map(function () {});
        }

        this.recordStep('Autoprefixing CSS');

        return Elixir.Plugins.autoprefixer(
            Elixir.config.css.autoprefix.options
        );
    }


    /**
     * Minify the relevant CSS or JS files.
     */
    minify() {
        if (! Elixir.inProduction) {
            return map(function () {});
        }

        this.recordStep('Applying Minification');

        return minifier(this.output);
    }


    /**
     * Apply concatenation to the incoming stream.
     */
    concat() {
        this.recordStep('Concatenating Files');

        return Elixir.Plugins.concat(this.output.name);
    }


    /**
     * Set the destination path.
     *
     * @param {object} gulp
     */
    saveAs(gulp) {
        this.recordStep('Saving to Destination');

        return gulp.dest(this.output.baseDir);
    }


    /**
     * Handle successful compilation.
     *
     * @param {string|null} message
     */
    onSuccess(message) {
        message = message || `${this.ucName()} Compiled!`;

        return new Elixir.Notification(message);
    }


    /**
     * Handle a compilation error.
     */
    onError(e) {
        let task = this.ucName();

        return function (e) {
            new Elixir.Notification().error(
                e, `${task} Compilation Failed!`
            );

            this.emit('end');
        };
    }


    /**
     * Log the task input and output.
     *
     * @param {string|null} message
     */
    log(message) {
        if (message) {
            return Elixir.log.status(message);
        }

        // As long as we're not triggering the entire
        // suite, we can log the stats for this task.
        if (! Elixir.isRunningAllTasks) {
            Elixir.log.task(this);
        }
    }


    /**
     * Record a step to the summary list.
     *
     * @param {string} message
     */
    recordStep(message) {
        this.steps.push(message);
    }


    /**
     * Translate the task instance to a registered Gulp task.
     */
    toGulp() {
        const name = this.name;

        // If we've already created a Gulp task,
        // we can exit early. Nothing to do.
        if (_.has(gulp.tasks, name)) {
            return;
        }

        gulp.task(name, () => {
            if (shouldRunAllTasksWithName(name)) {
                return Elixir.tasks.byName(name)
                    .forEach(task => task.run());
            }

            // Otherwise, we can run the current task.
            return Elixir.tasks.findIncompleteByName(name)[0].run();
        });
    }
}


/**
 * See if we should run all mixins for the given task name.
 *
 * @param  {string} name
 * @return {boolean}
 */
const shouldRunAllTasksWithName = function(name) {
    return _.intersection(gutils.env._, [name, 'watch', 'tdd']).length;
};


export default Task;
