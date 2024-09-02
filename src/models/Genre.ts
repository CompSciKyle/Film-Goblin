import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface genreProps {
	id?: number;
	name: "Comedy" | "Romance" | "Action" | "Scifi" | "Horror" | "Drama" | "Thriller";
}

export default class Genre {
	constructor(
		private sql: postgres.Sql<any>,
		public props: genreProps,
	) {}

	static async create(sql: postgres.Sql<any>, props: genreProps): Promise<Genre> {
		const connection = await sql.reserve();

		const [row] = await connection<genreProps[]>`
			INSERT INTO genre
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;

		await connection.release();

		return new Genre(sql, convertToCase(snakeToCamel, row) as genreProps);
	}

	static async read(sql: postgres.Sql<any>, id: number) {
		const connection = await sql.reserve();

		const [row] = await connection<genreProps[]>`
			SELECT * FROM
			genre WHERE id = ${id}`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Genre(sql, convertToCase(snakeToCamel, row) as genreProps);
	}

}
