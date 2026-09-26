import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

const convex = new ConvexHttpClient('https://ceaseless-bloodhound-791.convex.cloud');

async function main() {
  const user = await convex.query(anyApi.users.getUserByEmail, { email: 'amossomoloye65@gmail.com' });
  console.log('User found:', user?._id, user?.email);
}

main().catch(console.error);
