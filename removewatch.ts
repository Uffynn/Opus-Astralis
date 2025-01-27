import sqlite3 from "sqlite3";

// Define the path to the database file
const DB_FILE = "watchlist.db";

/**
 * Removes a contract address (CA) from the watchlist in the database.
 *
 * @param ca - The contract address (CA) of the token to be removed from the watchlist.
 */
function removeFromWatchlist(ca: string): void {
  // Connect to the SQLite database
  const db = new sqlite3.Database(DB_FILE);

  db.run("DELETE FROM watchlist WHERE ca = ?", [ca], function (err) {
    if (err) {
      console.error(`Error while removing CA ${ca}:`, err.message);
    } else if (this.changes > 0) {
      console.log(`Successfully removed CA: ${ca} from the watchlist.`);
    } else {
      console.log(`CA: ${ca} not found in the watchlist.`);
    }
  });

  // Close the database connection
  db.close();
}

// Main execution block
if (require.main === module) {
  // Check if the script was run with the correct number of arguments
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: node removewatch.js <ca>");
    process.exit(1);
  }

  // Get the contract address (CA) to be removed from the command line argument
  const caToRemove = args[0];

  // Call the function to remove the contract address from the watchlist
  removeFromWatchlist(caToRemove);
}
