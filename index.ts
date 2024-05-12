import puppeteer from "puppeteer";
const fs = require("fs");

async function scrapeData() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigating to the job search page
    await page.goto(
        "https://jobgether.com/search-offers?locations=622a65ad671f2c8b98fac69b",
        { waitUntil: "networkidle2" }
    );

    let scrapedData: { title: string; company: string; remote: string; companyDescription: string | undefined; numberOfEmployees: string | undefined; companyLink: string | null | undefined; }[] = [];

    let uniqueCompanies: Set<string> = new Set();

    // Check if companies.json already exists
    let existingCompanies = [];
    if (fs.existsSync("companies.json")) {
        existingCompanies = JSON.parse(fs.readFileSync("companies.json"));
        uniqueCompanies = new Set(existingCompanies);
    }

    async function scrapePage() {
        await page.waitForSelector(".new-opportunity.cards_container");

        // Targeting job cards
        const cards = await page.$$(".new-opportunity.cards_container");

        for (const card of cards) {
            const titleElement = await card.$(".title");
            const title = titleElement
                ? ((await (
                    await titleElement.getProperty("textContent")
                ).jsonValue()) as string)
                : "";

            const companyElement = await card.$(
                ".offer-card-container .tw-mb-1 .tw-uppercase"
            );
            const company = companyElement
                ? ((await (
                    await companyElement.getProperty("textContent")
                ).jsonValue()) as string)
                : "";

            const remoteElement = await card.$(
                ".location_icons_container .pt-1.text-nowrap"
            );
            const remote = remoteElement
                ? (
                    (await (
                        await remoteElement.getProperty("textContent")
                    ).jsonValue()) as string
                ).toLowerCase()
                : "";

            // If all data is present and remote is Pakistan, add to scrapedData
            if (title && company && remote && remote === "pakistan") {

                const linkElement = await card.$('a[href*="/offer/"]');
                const href = await linkElement?.evaluate((el) => el.getAttribute('href'));

                // Constructing the complete link
                const completeLink = `https://jobgether.com${href}`;

                // Opening a new tab and visiting the complete link
                const newPage = await browser.newPage();
                await newPage.goto(completeLink, { waitUntil: 'networkidle2' });

                // Targeting card with classes 'company_data_container' and 'info_card_shadow'
                const companyCard = await newPage.$('.company_data_container.info_card_shadow');

                // Extracting company description, number of employees, and company link
                const companyDescription = await companyCard?.$eval('.fs-14.ff-primary.position-relative.fw-300.text-uppercase', el => el.textContent?.trim());

                const numberOfEmployees = await companyCard?.$eval('.ms-1.me-1', el => el.textContent?.trim());

                const companyLink = await companyCard?.$eval('.company_link', el => el.getAttribute('href'));

                scrapedData.push({ title, company, remote, companyDescription, numberOfEmployees, companyLink });
                uniqueCompanies.add(company);
            }
        }
        console.log(`Number of unique companies: ${uniqueCompanies.size}`);
        console.log(scrapedData);

        // Write unique companies to companies.json
        fs.writeFileSync("companies.json", JSON.stringify(Array.from(uniqueCompanies)));

        // Clicking 'See More' button if available and scrape more cards
        const seeMoreButton = await page.$('a[href*="/search-offers/"]');
        if (seeMoreButton) {
            await seeMoreButton.click();
            await page.waitForNavigation({ waitUntil: "networkidle2" });
            await scrapePage();
        }
    }

    // Initiating scraping
    await scrapePage();
    await browser.close();
}

scrapeData();
