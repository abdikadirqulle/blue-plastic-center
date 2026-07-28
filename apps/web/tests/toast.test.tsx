import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Toast } from "../components/ui/toast"

describe("Toast", () => {
  it.each([
    ["success", "status"],
    ["error", "alert"],
    ["warning", "status"],
    ["info", "status"],
  ] as const)("renders the %s state accessibly", (variant, role) => {
    render(
      <Toast
        message={{ title: `${variant} title`, description: "Useful details", variant }}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole(role)).toHaveTextContent(`${variant} title`)
    expect(screen.getByRole(role)).toHaveClass("top-[72px]")
  })

  it("closes from the accessible dismiss button", () => {
    const onClose = vi.fn()
    render(<Toast message={{ title: "Saved", variant: "success" }} onClose={onClose} />)

    fireEvent.click(screen.getByRole("button", { name: "Close notification" }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
