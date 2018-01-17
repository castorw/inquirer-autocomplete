const chalk = require('chalk');
const inquirer = require('inquirer');

const colors = require(__dirname + '/colors');
const colorNames = Object.keys(colors);

inquirer.registerPrompt('autocomplete', require('../index'));

inquirer.prompt({
    type: 'autocomplete',
    name: 'color',
    message: 'What is your favorite color?',
    debounce: 200,
    source(answersSoFar, input) {
        input = input || '';
        return colorNames
            .filter(color => color.indexOf(input.toLowerCase()) >= 0)
            .map(color => ({ name: color, value: colors[color] }))
    }
}).then(answers => {
    const { color } = answers;
    console.log(chalk.hex(color)("You chose " + color + "!"));
})
