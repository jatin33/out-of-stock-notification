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

interface Image {
	image: string;
	_id: string;
	_metadata: {
		image: {
			name: string;
			type: string;
			size: number;
			_id: string;
			data?: string;
		};
	};
}

interface Product {
	_id: string;
	name: string;
	sku: string;
	price: number;
	brand: string;
	available: number;
	inventory_quantity: number;
	inventory_low_stock_quantity: number;
	images: Image[];
	metafields: {
		uom: string;
		product_type: string;
		ingredients: string;
		benefits: string;
		how_to_useit: string;
		weight: string;
		shot_description?: string;
	};
}

interface BaseReponseMessage {
	level: string;
	name: string;
};

interface BrandFacet {
	value: string;
	count: number;
}

interface BaseResponsePaging {
	count: number;
	limit: number;
	start: number;
	total: number;
	"attributes._brand": BrandFacet[];
}

interface BaseResponse<T> {
	messages: BaseReponseMessage[];
	fileBaseUrl: string;
	paging: BaseResponsePaging;
	data: T;
}

interface ProductAvailability {
	name: string;
	sku: string;
	price: number;
	inStock: boolean;
	inventory: number;
	lowStockThreshold: number;
	imageUrl?: string;
}

class StockMonitor {
	private readonly apiUrl: string;

	constructor(apiUrl: string) {
		this.apiUrl = apiUrl;
	}

	private async fetchProducts(): Promise<BaseResponse<Product[]>> {
		try {
			const response = await fetch(this.apiUrl, {
				headers: {
					'accept': 'application/json',
					'frontend': '1'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json() as BaseResponse<Product[]>;
		} catch (error) {
			console.error('Error fetching products:', error);
			throw error;
		}
	}

	public async checkSpecificProduct(identifier: string): Promise<ProductAvailability | null> {
		try {
			const products = await this.fetchProducts();
			const product = products?.data?.find(p => p.sku === identifier || p._id === identifier);

			if (!product) {
				return null;
			}

			const isOutOfStock =
				product.available === 0 ||
				(product.inventory_quantity <= product.inventory_low_stock_quantity);

			return {
				name: product.name,
				sku: product.sku,
				price: product.price,
				inStock: !isOutOfStock,
				inventory: product.inventory_quantity,
				lowStockThreshold: product.inventory_low_stock_quantity,
				imageUrl: product.images[0]?.image
			};
		} catch (error) {
			console.error('Error checking specific product:', error);
			throw error;
		}
	}
}

const AMUL_API_URL = 'https://shop.amul.com/api/1/entity/ms.products?fields[name]=1&fields[sku]=1&fields[price]=1&fields[available]=1&fields[inventory_quantity]=1&fields[inventory_low_stock_quantity]=1&fields[images]=1&filters[0][field]=categories&filters[0][value][0]=protein';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const monitor = new StockMonitor(AMUL_API_URL);
		const product = await monitor.checkSpecificProduct('LASCP40_30');
		return new Response(!product?.inStock ? `${product?.name} is out of stock` : `${product?.name} is back in stock`);
	},

	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		try {
			const monitor = new StockMonitor(AMUL_API_URL);
			// amul high protein rose lassi sku_id
			const product = await monitor.checkSpecificProduct('LASCP40_30');

			if (product?.inStock === false) {
				// env.STOCK_KV.put("out-of-stock", `1`, {
				// 	metadata: {
				// 		product
				// 	}
				// });
				console.log(`${product?.name} is out of stock`);
				await sendSMS(env, `${product?.name} is out of stock`);
			} else {
				// env.STOCK_KV.put("out-of-stock", `0`, {
				// 	metadata: {
				// 		product
				// 	}
				// });
				await sendSMS(env, `${product?.name} is back in stock`);
			}

			// const outOfStockCountInKV = await env.STOCK_KV.getWithMetadata("out-of-stock");
			// // came back in stock
			// if (outOfStockCountInKV.value === `0`) {
			// 	await sendSMS(env, `${(outOfStockCountInKV?.metadata as any)?.product?.name} is back in stock`);
			// } else {
			// 	console.log(`${(outOfStockCountInKV?.metadata as any)?.product?.name} is out of stock`);
			// }

			console.log('Test message sent');
		} catch (error) {
			console.error('Failed:', error);
		}
	}
};


async function sendSMS(env: Env, message: string) {
	const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

	const encoded = new URLSearchParams({
		To: env.TARGET_PHONE_NUMBER,
		From: env.TWILIO_PHONE_NUMBER,
		Body: `Hello from Amul stock notifier: ${message}`,
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