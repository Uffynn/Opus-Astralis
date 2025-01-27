import sqlite3 from "sqlite3";

// Define the path to the database file
const DB_FILE = "watchlist.db";

function analyzePerformance(): void {
  /**
   * Analyzes the performance of the tokens in the watchlist database.
   *
   * This function retrieves data from the 'watchlist' table, including contract address (CA),
   * initial price, current price, highest multiplier, and group name. It calculates statistics
   * like the highest multiplier, win rates per group, and overall performance.
   */

  // Connect to the SQLite database
  const db = new sqlite3.Database(DB_FILE);

  // Query to fetch data from the watchlist ordered by the highest multiplier in descending order
  const query = `
    SELECT ca, initial_price, current_price, highest_multiplier, group_name
    FROM watchlist
    ORDER BY highest_multiplier DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error querying the database:", err.message);
      return;
    }

    // Initialize variables to track the total number of contract addresses (CAs) and group statistics
    const totalCA = rows.length;
    const groupStats: Record<
      string,
      { total: number; wins: number }
    > = {};

    // Print headers for the detailed output table
    console.log("CA | Highest Multiplier | From Group"); 
    console.log("-".repeat(40));

    let lineDrawn = false; // Flag to control when to draw a separating line in the output

    // Process each row (representing a token entry)
    rows.forEach((row: any) => {
      const { ca, initial_price, current_price, highest_multiplier, group_name } = row;

      // Draw a line only after the first entry with a multiplier less than 1.5
      if (highest_multiplier < 1.5 && !lineDrawn) {
        console.log("\n" + "-".repeat(30) + "\n");
        lineDrawn = true;
      }

      // Print the contract address, highest multiplier, and group name
      console.log(`${ca} | ${highest_multiplier.toFixed(2)}x | ${group_name}`);

      // Initialize group statistics if the group hasn't been encountered yet
      if (!groupStats[group_name]) {
        groupStats[group_name] = { total: 0, wins: 0 };
      }

      // Track the total number of tokens in the group
      groupStats[group_name].total++;

      // Track wins (multiplier >= 1.5 is considered a win)
      if (highest_multiplier >= 1.5) {
        groupStats[group_name].wins++;
      }
    });

    // Output the performance statistics per group
    console.log("\nGroup Performance Stats:");
    const overallWins = Object.values(groupStats).reduce((sum, stats) => sum + stats.wins, 0);
    const overallTotal = Object.values(groupStats).reduce((sum, stats) => sum + stats.total, 0);

    // Calculate the overall win rate
    const overallWinRate = overallTotal > 0 ? (overallWins / overallTotal) * 100 : 0;
    console.log(`Plays Overall: ${overallTotal}`);
    console.log(`Winrate Overall: ${overallWinRate.toFixed(2)}%`);

    // Print statistics for each group
    for (const [group, stats] of Object.entries(groupStats)) {
      const groupWinRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
      console.log(`Group: ${group}`);
      console.log(`  Total CAs: ${stats.total}`);
      console.log(`  Winrate Group: ${groupWinRate.toFixed(2)}%`);
    }
  });

  // Close the database connection
  db.close();
}

// Call the function to analyze performance when the script is run directly
if (require.main === module) {
  analyzePerformance();
}
