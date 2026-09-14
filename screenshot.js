const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

  // Member app — mobile viewport
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const memberId = process.argv[2];

  const home = await mobile.newPage();
  await home.goto(`http://localhost:3210/app/?demo=${memberId}`);
  await home.waitForTimeout(500);
  await home.screenshot({ path: 'shots/member-home.png' });

  const onboard = await mobile.newPage();
  await onboard.goto(`http://localhost:3210/app/onboarding.html?demo=${memberId}`);
  await onboard.evaluate((id) => localStorage.setItem('medfit_member_id', id), memberId);
  await onboard.reload();
  await onboard.waitForTimeout(300);
  await onboard.screenshot({ path: 'shots/member-onboarding.png' });

  const coach = await mobile.newPage();
  await coach.goto(`http://localhost:3210/app/index.html`);
  await coach.waitForTimeout(300);
  await coach.click('[data-ask="What\'s my grocery list for this week?"]');
  await coach.waitForTimeout(600);
  await coach.fill('#chatInput', "I'm going to Ruth's Chris tonight and I'm doing a Mediterranean-style diet, what should I get?");
  await coach.click('#chatSend');
  await coach.waitForTimeout(600);
  await coach.screenshot({ path: 'shots/member-coach.png' });

  const logPage = await mobile.newPage();
  await logPage.goto(`http://localhost:3210/app/index.html`);
  await logPage.waitForTimeout(300);
  await logPage.click('[data-nav="log"]');
  await logPage.waitForTimeout(300);
  await logPage.screenshot({ path: 'shots/member-log.png' });

  const progressPage = await mobile.newPage();
  await progressPage.goto(`http://localhost:3210/app/index.html`);
  await progressPage.waitForTimeout(300);
  await progressPage.click('[data-nav="progress"]');
  await progressPage.waitForTimeout(400);
  await progressPage.screenshot({ path: 'shots/member-progress.png' });

  await mobile.close();

  // Employer dashboard — desktop viewport
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const emp = await desktop.newPage();
  await emp.goto('http://localhost:3210/employer/?employer=demo-employer');
  await emp.waitForTimeout(500);
  await emp.screenshot({ path: 'shots/employer-dashboard.png', fullPage: true });

  await emp.click('tr.member-row');
  await emp.waitForTimeout(400);
  await emp.screenshot({ path: 'shots/employer-drilldown.png' });

  await desktop.close();
  await browser.close();
  console.log('Screenshots saved to shots/');
})();
