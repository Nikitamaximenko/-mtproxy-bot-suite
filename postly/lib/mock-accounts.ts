export type ConnectedAccount = {
  /** Будущий account_id из Postmypost */
  id: number
  network: "vk" | "telegram" | "odnoklassniki" | "rutube" | "dzen"
  /** Имя страницы/канала */
  name: string
  /** URL аватарки или undefined */
  avatarUrl?: string
}

export const MOCK_ACCOUNTS: ConnectedAccount[] = [
  { id: 1, network: "vk", name: "Кофейня на Малой Бронной" },
  { id: 2, network: "telegram", name: "@bronnaya_coffee" },
  { id: 3, network: "odnoklassniki", name: "Кофейня Бронная" },
  { id: 4, network: "rutube", name: "Bronnaya Coffee" },
]
