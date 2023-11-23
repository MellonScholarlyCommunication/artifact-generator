const commander = require('commander');
const YAML = require('yaml');
const fs = require('fs');

commander
    .version('1.0.0','-v, --version')
    .argument('<scenario>')
    .argument('[<directory]')
    .option('-b, --baseUrl <url>', 'Pod base URL', 'http://localhost:3000')
    .option('-l, --lookup <file>', 'Resolve names', __dirname + '/config/lookup.yml')
    .option('-s, --style <file>', 'HTML style', __dirname + '/config/default.html')
    .parse(process.argv);

const options = commander.opts();

const scenarioFile = commander.args[0]
const outputDir = commander.args[1];

const scenario = YAML.parseDocument(fs.readFileSync(scenarioFile, 'utf8')).toJS();
const lookup = YAML.parseDocument(fs.readFileSync(options.lookup,'utf-8')).toJS();
const style = fs.readFileSync(options.style,'utf-8');

doit();

async function doit() {
    let markdown = makeMarkdown();

    if (outputDir && scenario['$']) {
        let path = `${outputDir}/${scenario['$']}`;
        
        // Make publication
        fs.mkdirSync(path, {recursive: true});

        fs.writeFileSync(`${path}/index.md`,markdown);

        // Make inbox
        fs.mkdirSync(`${path}/inbox`, {recursive: true});

        // Make meta
        fs.writeFileSync(`${path}/.meta`,makeMeta());

        console.error(`> ${path}/index.md`);
    }
    else {
        console.log(output);
    }
}

function makeMeta() {
    return `
<${options.baseUrl}/${scenario['$']}> <http://www.w3.org/ns/ldp#inbox> <${options.baseUrl}/${scenario['$']}/inbox/> .
`.trim();
}

function makeMarkdown() {
    let output = '';

    if (scenario['title']) {
        output += `# ${scenario['title']}\n`;
    }
    else {
        output += `# No title\n`;
    }

    output += "\n" + style + "\n\n";

    if (scenario['author']) {
        for (let i = 0 ; i < scenario['author'].length ; i++) {
            let author = scenario['author'][i];
            let url = lookup[author] || '';
            output += `[${author}](${url})`;

            if (i == scenario['author'].length - 2) {
                output += " and \n";
            }
            else if (i < scenario['author'].length - 1) {
                output += ", \n";
            }
        }

        output += "\n";
    }

    output += "\n## Year\n\n";

    if (scenario['year']) {
        output += scenario['year'] + "\n";
    }
    else {
        ouput += "_no year_\n";
    }

    output += "\n## Publication\n\n";

    if (scenario['publication']) {
        let publication = scenario['publication'];
        let url = lookup[publication] || '';

        output += `[${publication}](${url})\n`;
    }
    else {
        output += "_no publication_\n";
    }

    output += "\n## DOI\n\n";

    if (scenario['doi']) {
        let doi = scenario['doi'];

        output += `[${doi}](http://doi.org/${doi})\n`;
    }
    else {
        output += "_no doi_\n";
    }

    output += "\n## ABSTRACT\n\n";

    if (scenario['abstract']) {
        output += `${scenario['abstract']}\n`;
    }
    else {
        output += "_no abstract_\n";
    }

    output += "\n## DOWNLOADS\n\n";

    if (scenario['files']) {
        for (let i = 0 ; i < scenario['files'].length ; i++) {
            let file = scenario['files'][i];
            output += `- [${file}](${file})\n`;           
        }
    }
    else {
        output += "_no files_\n";
    }

    return output;
}