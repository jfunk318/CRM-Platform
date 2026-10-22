-- The first business was set up with the "Beeze Tees" placeholder. Rename it
-- to the neutral "Company Name" placeholder: name, platform address (slug),
-- custom domain, root store name and the .test development logins. Only
-- values still at the old placeholder are changed, and only if the new ones
-- are free. (The internal id 'biz_beezetees' stays; it's never shown.)
UPDATE "Business" SET "slug" = 'companyname'
WHERE "slug" = 'beezetees' AND NOT EXISTS (SELECT 1 FROM "Business" WHERE "slug" = 'companyname');

UPDATE "Business" SET "name" = 'Company Name' WHERE "name" = 'Beeze Tees';

UPDATE "Business" SET "customDomain" = 'companyname.com'
WHERE "customDomain" = 'beezetees.com' AND NOT EXISTS (SELECT 1 FROM "Business" WHERE "customDomain" = 'companyname.com');

UPDATE "Store" SET "name" = 'Company Name' WHERE "name" = 'Beeze Tees';

UPDATE "StaffUser" s SET "email" = replace(s."email", '@beezetees.test', '@companyname.test')
WHERE s."email" LIKE '%@beezetees.test'
  AND NOT EXISTS (SELECT 1 FROM "StaffUser" o WHERE o."businessId" = s."businessId" AND o."email" = replace(s."email", '@beezetees.test', '@companyname.test'));
