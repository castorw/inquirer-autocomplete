const chalk = require('chalk');
const figures = require('figures');
const runAsync = require('run-async');
const Base = require('inquirer/lib/prompts/base');
const Choices = require('inquirer/lib/objects/choices');
const observe = require('inquirer/lib/utils/events');
const utils = require('inquirer/lib/utils/readline');
const Paginator = require('inquirer/lib/utils/paginator');
const _debounce = require('lodash.debounce');

class Autocomplete extends Base {
    constructor() {
        super(...arguments);

        if (!this.opt.source)
            this.throwParamError('source');

        this.currentChoices = [];
        this.firstRender = true;
        this.selected = 0;
        this.opt.default = null;

        this.paginator = new Paginator();

        if (this.opt.debounce) {
            this._searchImpl = _debounce(this._searchImpl.bind(this), this.opt.debounce);
        }
    }

    _run(cb) {
        this.done = cb;

        if (this.rl.history instanceof Array) {
            this.rl.history = [];
        }

        const events = observe(this.rl);
        const dontHaveAnswer = () => !this.answer;
        events.line.takeWhile(dontHaveAnswer).forEach(this.onSubmit.bind(this));
        events.keypress.takeWhile(dontHaveAnswer).forEach(this.onKeypress.bind(this));

        this.search(this.opt.defaultQuery);

        return this;
    }

    search(query) {
        this.selected = 0;

        if (this.searchedOnce) {
            this.searching = true;
            this.currentChoices = new Choices([]);
            this.render();
        }

        this._searchImpl(query);
    }

    _searchImpl(query) {
        this.searchedOnce = true;
        this.lastSearchTerm = query;

        const thisPromise = Promise.resolve().then(() => this.opt.source(this.answers, query));
        this.lastPromise = thisPromise;

        return thisPromise.then(function _afterSearch(choices) {
            if (thisPromise === this.lastPromise) {
                this.currentChoices = new Choices(choices.filter(c => c.type !== 'separator'));
                this.searching = false;
                this.render();
            }
        }.bind(this));
    }

    render(error) {
        let content = this.getQuestion();
        let bottomContent = '';

        if (this.firstRender) {
            content += chalk.dim('(Use arrow keys or type to search)');

            if (this.opt.defaultQuery) {
                // this makes it write the correct thing to the stream, but doesn't display it.
                setImmediate(() =>  this.rl.write(this.opt.defaultQuery));
                // we'll just append it to the content on the first render to make it appear.
                content += ' ' + this.opt.defaultQuery;                
            }            
        }

        if (this.status === 'answered') {
            content += chalk.cyan(this.shortAnswer || this.answerName || this.answer);
        } else if (this.searching) {
            content += this.rl.line;
            bottomContent += ' ' + chalk.dim('Searching...');
        } else if (this.currentChoices.length) {
            content += this.rl.line;
            const choicesStr = this._listRender(this.currentChoices, this.selected);
            bottomContent += this.paginator.paginate(choicesStr, this.selected, this.opt.pageSize);
        } else {
            content += this.rl.line;
            bottomContent += '  ' + chalk.yellow('No results...');
        }

        if (error) {
            bottomContent += '\n' + chalk.red('>> ') + error;
        }

        this.screen.render(content, bottomContent);
        this.firstRender = false;
    }

    _listRender(choices, pointer) {
        let separatorOffset = 0;
        let lines = [];

        for(let i = 0; i < choices.length; ++i) {
            const choice = choices.getChoice(i);
            if (choice.type === 'separator') {
                separatorOffset += 1;
                lines.push('  ' + choice);
            } else if (i - separatorOffset === pointer) { // isSelected
                lines.push(chalk.cyan(figures.pointer + ' ' + choice.name));
            } else {
                lines.push('  ' + choice.name);
            }
        }

        return lines.join('\n');
    }

    onKeypress(evt) {
        const key = (evt.key && evt.key.name) || undefined;

        if (key === 'down') {
            this.selected = (this.selected < this.currentChoices.length - 1 ? this.selected + 1 : 0);
            this.render();
            utils.up(this.rl, 2);
        } else if (key === 'up') {
            this.selected = (this.selected > 0 ? this.selected - 1 : this.currentChoices.length - 1);
            this.render();
        } else {
            this.render();
            if (this.lastSearchTerm !== this.rl.line) {
                this.search(this.rl.line);
            }
        }
    }

    onSubmit(evt) {
        const choice = this.currentChoices.getChoice(this.selected);
        this.answer = choice.value;
        this.answerName = choice.name;
        this.shortAnswer = choice.short;

        runAsync(this.opt.filter, (err, value) => {
            choice.value = value;
            this.answer = value;
            this.status = 'answered';
            this.render();
            this.screen.done();
            this.done(choice.value);
        })(choice.value);
    }
}

module.exports = Autocomplete;
