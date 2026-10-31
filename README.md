# SMKSC academic portal

Admins upload and delete PDF and Word documents (up to 4 MB). Students download the original documents under the selected course's Question Papers or Study Notes tab. Courses and file records use Netlify Database; file contents use Netlify Blobs.

## Administrator setup

In the Netlify project dashboard, open **Identity**, invite the administrator's email address, open their user details, and add the **admin** role. Accept the email invitation on the deployed site and choose a password. Use that email and password in **Admin Login**. Admin accounts must have the admin role before uploading, deleting, or changing courses.

## Validation

Run `npm test` and `npm run check`. The platform applies the database migrations during deployment. Local platform emulation uses `netlify dev --port 8889`.
