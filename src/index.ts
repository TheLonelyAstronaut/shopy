import { chromium } from 'playwright';
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN!);

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

bot.launch();

async function main() {
  const availableDoctors = [];
  const requiredDoctors = [{
    name: 'Бествицкая',
    pageNumber: 1
  }, {
    name: 'Гергалова',
    pageNumber: 1
  }];

  const parsePage = async (doctor: string, pageNumber: number = 1) => {
    const browser = await chromium.launch({
        headless: true,
        slowMo: 100
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`https://www.lode.by/doctors/?CITY=minsk&SPECIALITY=vYZHk9KR&PAGEN_1=${pageNumber}`, {
        waitUntil: 'domcontentloaded'
    });

    const itemsContainer = await page.locator('#items-container');
    await itemsContainer.waitFor({ state: 'visible' });
    
    console.log(`[${doctor}] Found items-container`);

    const doctorElement = itemsContainer.locator(`> *:has-text("${doctor}")`);

    await page.waitForTimeout(2000);
    
    const signUpButton = doctorElement.locator('button:has-text("Записаться")');
    await signUpButton.click();

    await page.waitForTimeout(5000);

    const noTimeAvailable = await page.locator('text="НЕТ СВОБОДНОГО ВРЕМЕНИ ДЛЯ ЗАПИСИ"').count();
    const isAvailable = noTimeAvailable === 0;
    
    console.log(`[${doctor}] Available: ${isAvailable}`);

    await browser.close();
    
    return isAvailable ? doctor : null;
  }
  
  do {
    const data = await Promise.all(requiredDoctors.map((doctor) => parsePage(doctor.name, doctor.pageNumber))).then(results => results.filter(Boolean));

    console.log(`[${new Date().toISOString()}] Found ${data.length} available doctors, waiting for 5 min`);

    if (data.length > 0) {
        await bot.telegram.sendMessage(Number.parseInt(process.env.CHAT_ID!), `Найдены доступные врачи: ${data.join(', ')}`);
    }

    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
  } while (availableDoctors.length === 0);
}

main().catch(console.error);

