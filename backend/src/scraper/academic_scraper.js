function parseCourseData(html) {
  const $ = cheerio.load(html);
  const courses = [];

  // Find all course rows
  $('tr[id^="trCRSE_HIST$"]').each((index, element) => {
    const row = $(element);

    // Extract course code from CRSE_NAME span
    const code = row.find('span[id^="CRSE_NAME$"]').text().trim();

    // Extract course title from PSHYPERLINK class
    const title = row.find("a.PSHYPERLINK").text().trim();

    // Extract term from CRSE_TERM span
    const term = row.find('span[id^="CRSE_TERM$"]').text().trim();

    // Extract grade from ps-label span
    const grade = row
      .find('div[id^="win0divDERIVED_SSS_HST_SSR_GRADE_LONG$"] span.ps-label')
      .text()
      .trim();

    // Extract credits from CRSE_UNITS span
    const credits = row.find('span[id^="CRSE_UNITS$"]').text().trim();

    // Extract status from image alt text
    const status =
      row.find('img[src*="PS_CS_CREDIT_TAKEN_ICN"]').attr("alt") || "Unknown";

    // Only add the course if we have the essential information
    if (code && title) {
      courses.push({
        code,
        name: title,
        term,
        grade: grade || "IP", // IP = In Progress if no grade
        credits: credits || "0",
        requirementGroup: null, // This will be set later based on the course code
        isRecommended: false,
        isFuture: false,
      });
    }
  });

  return courses;
}
