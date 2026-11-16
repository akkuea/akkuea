import type { Meta, StoryObj } from "@storybook/react";
import { NavbarView } from "./Navbar";

const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";
const OPERATOR = "GDTNXRLOJD2YEBPKK7KCMR7J33AAG5VZXHAJTHIG736D6LVEFLLLKPDL";

const meta: Meta<typeof NavbarView> = {
  title: "Layout/Navbar",
  component: NavbarView,
  parameters: { layout: "fullscreen" },
  args: {
    pathname: "/",
    connectedAddress: null,
    allyAddress: ALLY,
    brandSlot: <span className="text-sm font-semibold text-white">AKKUEA</span>,
    rightSlot: null,
  },
};

export default meta;
type Story = StoryObj<typeof NavbarView>;

export const Visitor: Story = {};

export const ActiveInvestorRoute: Story = {
  args: {
    pathname: "/pilot/investor",
  },
};

export const ConnectedAlly: Story = {
  args: {
    pathname: "/pilot/ally",
    connectedAddress: ALLY,
  },
};

export const ConnectedOperator: Story = {
  args: {
    pathname: "/pilot/review/evidence",
    connectedAddress: OPERATOR,
  },
};
