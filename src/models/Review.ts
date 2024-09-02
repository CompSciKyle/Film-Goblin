import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface ReviewProps {
	id?: number;
    comment: string;
    rating: number;
    movieId: number;
}

export default class Review {
	constructor(
		private sql: postgres.Sql<any>,
		public props: ReviewProps,
	) {}

	static async create(sql: postgres.Sql<any>, props: ReviewProps): Promise<Review> {
		const connection = await sql.reserve();

		const [row] = await connection<ReviewProps[]>`
			INSERT INTO review
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;

		await connection.release();

		return new Review(sql, convertToCase(snakeToCamel, row) as ReviewProps);
		
	}

	static async read(sql: postgres.Sql<any>, id: number) {
		const connection = await sql.reserve();

		const [row] = await connection<ReviewProps[]>`
			SELECT * FROM
			review WHERE movie_id = ${id}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Review(sql, convertToCase(snakeToCamel, row) as ReviewProps);
	}

	async delete() {
		const connection = await this.sql.reserve();

		const result = await connection`
			DELETE FROM review
			WHERE id = ${this.props.id}
		`;

		await connection.release();

		return result.count === 1;
	}
}
