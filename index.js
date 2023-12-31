const commander = require('commander');
const YAML = require('yaml');
const fs = require('fs');
const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;

commander
    .version('1.0.0','-v, --version')
    .argument('<scenario>')
    .argument('[<directory]')
    .option('-b, --baseUrl <url>', 'Pod base URL', 'http://localhost:3000/artifacts/')
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

        // Make RDF
        fs.writeFileSync(`${path}/.meta`,await makeRDF());

        // Make inbox
        fs.mkdirSync(`${path}/inbox`, {recursive: true});

        console.error(`> ${path}/index.md`);
    }
    else {
        console.log(markdown);
    }
}

async function makeRDF() {
    const writer = new N3.Writer();
    return new Promise( (resolve,reject) => {
        const base = `${options.baseUrl}/${scenario['$']}`;
        const subject = namedNode(`${base}/`);
        const DC = 'http://purl.org/dc/elements/1.1/';
        const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
        const LDP = 'http://www.w3.org/ns/ldp#';
        const IETF = 'http://www.iana.org/assignments/relation/';
        const SCHEMA = 'https://schema.org/';
        const LDES = 'https://w3id.org/ldes#';

        writer.addQuad(
            subject,
            namedNode(`${RDF}type`), 
            namedNode(`${SCHEMA}ScholarlyArticle`) 
        );

        writer.addQuad(
            subject,
            namedNode(`${RDF}type`), 
            namedNode(`${SCHEMA}AboutPage`) 
        );

        writer.addQuad(
            subject,
            namedNode(`${LDES}EventStream`),
            namedNode(`${base}/eventlog.jsonld#EventStream`)
        )

        writer.addQuad(
            subject,
            namedNode(`${LDP}inbox`), 
            namedNode(`${base}/inbox/`) 
        );

        if (scenario['title']) {
            writer.addQuad(
                subject,
                namedNode(`${DC}title`), 
                literal(scenario['title']) 
            );
        }

        if (scenario['author']) {
            for (let i = 0 ; i < scenario['author'].length ; i++) {
                let author = scenario['author'][i];
                let url = lookup[author] || '';

                if (url) {
                    writer.addQuad(
                        subject,
                        namedNode(`${DC}creator`), 
                        namedNode(url) 
                    ); 
                }
                else {
                    writer.addQuad(
                        subject,
                        namedNode(`${DC}creator`), 
                        literal(author) 
                    );    
                }
            }
        }

        if (scenario['year']) {
            writer.addQuad(
                subject,
                namedNode(`${DC}date`), 
                literal(scenario['year']) 
            );
        }

        if (scenario['publication']) {
            let publication = scenario['publication'];
            let url = lookup[publication] || '';
    
            if (url) {
                writer.addQuad(
                    subject,
                    namedNode(`${DC}isPartOf`), 
                    namedNode(url) 
                );
            }
            else {
                writer.addQuad(
                    subject,
                    namedNode(`${DC}isPartOf`), 
                    literal(publication) 
                ); 
            }
        }

        if (scenario['cite-as']) {
            let id = scenario['cite-as'];
    
            writer.addQuad(
                subject,
                namedNode(`${IETF}cite-as`), 
                namedNode(`${id}`) 
            ); 
        }

        if (scenario['doi']) {
            let id = scenario['doi'];
    
            writer.addQuad(
                subject,
                namedNode(`${SCHEMA}isRelatedTo`), 
                namedNode(`http://doi.org/${id}`) 
            ); 
        }

        if (scenario['abstract']) {
            writer.addQuad(
                subject,
                namedNode(`${DC}abstract`), 
                literal(scenario['abstract']) 
            ); 
        }

        if (scenario['files']) {
            for (let i = 0 ; i < scenario['files'].length ; i++) {
                let file = scenario['files'][i];

                writer.addQuad(
                    subject,
                    namedNode(`${DC}hasPart`), 
                    namedNode(file) 
                ); 
            }
        }
      
        writer.end((error, result) => {
            if (error)
                reject(error);
            resolve(result);
        });
    });
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

    if (scenario['year']) {
        output += "\n## YEAR\n\n";
        output += scenario['year'] + "\n";
    }

    if (scenario['publication']) {
        output += "\n## PUBLICATION\n\n";
        let publication = scenario['publication'];
        let url = lookup[publication] || '';

        if (url.match(/^http.*/)) {
            output += `[${publication}](${url})\n`;
        }
        else {
            output += `${publication}\n`;
        }
    }

    if (scenario['doi']) {
        output += "\n## RELATED\n\n";

        let doi = scenario['doi'];

        output += `[${doi}](http://doi.org/${doi})\n`;
    }

    if (scenario['cite-as']) {
        output += "\n## CITE-AS\n\n";

        let id = scenario['cite-as'];

        output += `[${id}](${id})\n`;
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

    if (scenario['extra']) {
        output += `\n${scenario['extra']}`
    }

    return output;
}