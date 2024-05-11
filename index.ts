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

    let scrapedData: { title: string; company: string; remote: string }[] = [];
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
                scrapedData.push({ title, company, remote });
                uniqueCompanies.add(company);
            }
        }
        console.log(`Number of unique companies: ${uniqueCompanies.size}`);

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
