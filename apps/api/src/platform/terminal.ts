import chalk from "chalk"

const label = (text: string, color: (value: string) => string) =>
  color(` ${text.toUpperCase()} `)

export const terminal = {
  banner(input: {
    host: string
    port: number
    environment: string
    persistence: string
    origins: string[]
  }) {
    const line = chalk.blue("─".repeat(62))
    console.log("")
    console.log(line)
    console.log(chalk.bold.white("  BLUE PLASTIC CENTER") + chalk.gray("  Accounting API"))
    console.log(line)
    console.log(`${label("ready", chalk.bgGreen.black)} ${chalk.green(`http://${input.host}:${input.port}`)}`)
    console.log(`${label("mode", chalk.bgBlue.white)} ${chalk.cyan(input.environment)}`)
    console.log(`${label("data", chalk.bgMagenta.white)} ${chalk.magenta(input.persistence)}`)
    console.log(`${label("cors", chalk.bgYellow.black)} ${chalk.yellow(input.origins.join(", "))}`)
    console.log(line)
    console.log(chalk.gray("  Press Ctrl+C to stop the API"))
    console.log("")
  },
  success(message: string) {
    console.log(`${chalk.green("✓")} ${chalk.green(message)}`)
  },
  warning(message: string) {
    console.warn(`${chalk.yellow("!")} ${chalk.yellow(message)}`)
  },
  error(message: string) {
    console.error(`${chalk.red("✕")} ${chalk.red(message)}`)
  },
}
