/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.json`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
// types.ts
   
   // worker.ts
   interface Env {
	TWILIO_ACCOUNT_SID: string;
	TWILIO_AUTH_TOKEN: string;
	TARGET_PHONE_NUMBER: string;
	TWILIO_PHONE_NUMBER: string;
   }
   
   
   export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new Response('OK');
	},

	async scheduled(
	  event: ScheduledEvent,
	  env: Env,
	  ctx: ExecutionContext
	): Promise<void> {
	  try {
		const testQuantity = 100;
		await sendSMS(env);
		console.log('Test message sent');
	  } catch (error) {
		console.error('Failed:', error);
	  }
	}
   };
   
   
   async function sendSMS(env: Env) {
	const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  
	const encoded = new URLSearchParams({
	  To: env.TARGET_PHONE_NUMBER,
	  From: env.TWILIO_PHONE_NUMBER,
	  Body: "Hello from Cloudflare",
	});
  
	const token = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  
	const request = {
	  body: encoded,
	  method: "POST",
	  headers: {
		Authorization: `Basic ${token}`,
		"Content-Type": "application/x-www-form-urlencoded",
	  },
	};
  
	const response = await fetch(endpoint, request);
	const result = await response.json();
  
	return Response.json(result);
  }