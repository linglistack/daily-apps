import Foundation

enum Slot: String, Codable, CaseIterable, Identifiable {
    case breakfast, lunch, dinner

    var id: String { rawValue }

    var title: String {
        switch self {
        case .breakfast: return "Breakfast"
        case .lunch: return "Lunch"
        case .dinner: return "Dinner"
        }
    }

    var symbol: String {
        switch self {
        case .breakfast: return "sunrise"
        case .lunch: return "sun.max"
        case .dinner: return "moon.stars"
        }
    }

    var order: Int { Slot.allCases.firstIndex(of: self) ?? 0 }
}

/// A dish a person makes, with what goes in it.
struct Meal: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var ingredients: [String]
    var note: String
}

/// One dish set for one meal of one day.
struct Planned: Codable, Identifiable, Hashable {
    var id = UUID()
    var day: Date
    var slot: Slot
    var mealID: UUID
}

/// Something on the grocery list that no planned dish brings.
struct Extra: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var done: Bool
}

struct Book: Codable {
    var meals: [Meal] = []
    var plan: [Planned] = []
    var checked: [String] = []
    var extras: [Extra] = []
}

/// One line of the grocery list, gathered from the week's dishes.
struct GroceryLine: Identifiable {
    let id: String
    let name: String
    let count: Int
}

/// Everything the app knows, kept in one file. While a screenshot is being made it holds sample
/// data instead and saves nothing, so the pictures never touch what a person entered.
@MainActor
final class Store: ObservableObject {
    @Published private(set) var book = Book()
    @Published private(set) var weekStart: Date

    private let file = Saved<Book>(name: "book")
    private let sample = DebugLaunch.shot != nil
    private let calendar = Calendar.current

    init() {
        let start = Store.startOfWeek(for: .now)
        weekStart = start
        book = sample ? Store.sampleBook(weekStart: start) : (file.load() ?? Book())
    }

    static func startOfWeek(for date: Date) -> Date {
        let calendar = Calendar.current
        return calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
    }

    // MARK: The week

    var days: [Date] {
        (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private var weekEnd: Date {
        calendar.date(byAdding: .day, value: 7, to: weekStart) ?? weekStart
    }

    var weekTitle: String {
        let last = calendar.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart
        let first = weekStart.formatted(.dateTime.month(.abbreviated).day())
        return "\(first) – \(last.formatted(.dateTime.month(.abbreviated).day()))"
    }

    var isThisWeek: Bool { weekStart == Store.startOfWeek(for: .now) }

    func moveWeek(by weeks: Int) {
        if let moved = calendar.date(byAdding: .weekOfYear, value: weeks, to: weekStart) {
            weekStart = moved
        }
    }

    func goToThisWeek() {
        weekStart = Store.startOfWeek(for: .now)
    }

    private var weekPlan: [Planned] {
        book.plan
            .filter { $0.day >= weekStart && $0.day < weekEnd }
            .sorted { ($0.day, $0.slot.order) < ($1.day, $1.slot.order) }
    }

    var plannedThisWeek: Int { weekPlan.count }

    func planned(on day: Date, _ slot: Slot) -> Meal? {
        guard let entry = book.plan.first(where: { $0.slot == slot && calendar.isDate($0.day, inSameDayAs: day) }) else { return nil }
        return meal(entry.mealID)
    }

    func set(_ meal: Meal, on day: Date, _ slot: Slot) {
        book.plan.removeAll { $0.slot == slot && calendar.isDate($0.day, inSameDayAs: day) }
        book.plan.append(Planned(day: calendar.startOfDay(for: day), slot: slot, mealID: meal.id))
        save()
    }

    func clear(_ day: Date, _ slot: Slot) {
        book.plan.removeAll { $0.slot == slot && calendar.isDate($0.day, inSameDayAs: day) }
        save()
    }

    func timesThisWeek(_ meal: Meal) -> Int {
        weekPlan.filter { $0.mealID == meal.id }.count
    }

    // MARK: Dishes

    var sortedMeals: [Meal] {
        book.meals.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func meal(_ id: UUID) -> Meal? {
        book.meals.first { $0.id == id }
    }

    func summary(of meal: Meal) -> String {
        meal.ingredients.isEmpty ? "No ingredients yet" : meal.ingredients.joined(separator: ", ")
    }

    func add(_ meal: Meal) {
        book.meals.append(meal)
        save()
    }

    func update(_ meal: Meal) {
        guard let index = book.meals.firstIndex(where: { $0.id == meal.id }) else { return }
        book.meals[index] = meal
        save()
    }

    func remove(_ meal: Meal) {
        book.meals.removeAll { $0.id == meal.id }
        book.plan.removeAll { $0.mealID == meal.id }
        save()
    }

    // MARK: Groceries

    /// What the week's dishes need, each ingredient once, with how many dishes call for it.
    var groceries: [GroceryLine] {
        var order: [String] = []
        var names: [String: String] = [:]
        var counts: [String: Int] = [:]
        for entry in weekPlan {
            guard let meal = meal(entry.mealID) else { continue }
            for item in meal.ingredients {
                let name = item.trimmingCharacters(in: .whitespaces)
                let key = name.lowercased()
                if key.isEmpty { continue }
                if counts[key] == nil {
                    order.append(key)
                    names[key] = name
                }
                counts[key, default: 0] += 1
            }
        }
        return order.map { GroceryLine(id: $0, name: names[$0] ?? $0, count: counts[$0] ?? 1) }
    }

    func isChecked(_ line: GroceryLine) -> Bool {
        book.checked.contains(line.id)
    }

    var anyChecked: Bool {
        groceries.contains { isChecked($0) } || book.extras.contains { $0.done }
    }

    func toggle(_ line: GroceryLine) {
        if isChecked(line) {
            book.checked.removeAll { $0 == line.id }
        } else {
            book.checked.append(line.id)
        }
        save()
    }

    func addExtra(_ name: String) {
        book.extras.append(Extra(name: name, done: false))
        save()
    }

    func toggle(_ extra: Extra) {
        guard let index = book.extras.firstIndex(where: { $0.id == extra.id }) else { return }
        book.extras[index].done.toggle()
        save()
    }

    func removeExtra(_ extra: Extra) {
        book.extras.removeAll { $0.id == extra.id }
        save()
    }

    /// Starts a new shop: unticks every dish's ingredient and drops the extras already bought.
    func clearChecked() {
        book.checked = []
        book.extras.removeAll { $0.done }
        save()
    }

    private func save() {
        if !sample { file.save(book) }
    }

    // MARK: Sample

    private static func sampleBook(weekStart: Date) -> Book {
        let calendar = Calendar.current
        let oats = Meal(name: "Overnight oats", ingredients: ["Rolled oats", "Milk", "Yogurt", "Berries"], note: "Make the night before.")
        let soup = Meal(name: "Red lentil soup", ingredients: ["Red lentils", "Onion", "Carrots", "Cumin", "Lemon"], note: "Doubles well for two lunches.")
        let tacos = Meal(name: "Chicken tacos", ingredients: ["Chicken thighs", "Tortillas", "Onion", "Lime", "Coriander", "Sour cream"], note: "Twenty minutes, start to finish.")
        let pasta = Meal(name: "Pasta with greens", ingredients: ["Pasta", "Spinach", "Garlic", "Parmesan", "Lemon"], note: "")
        let stirFry = Meal(name: "Tofu stir-fry", ingredients: ["Tofu", "Broccoli", "Peppers", "Soy sauce", "Rice", "Garlic"], note: "Press the tofu first.")
        let salad = Meal(name: "Tuna salad", ingredients: ["Tuna", "Lettuce", "Tomatoes", "Cucumber"], note: "")
        let eggs = Meal(name: "Baked eggs", ingredients: ["Eggs", "Tomatoes", "Peppers", "Bread"], note: "")
        var book = Book()
        book.meals = [oats, soup, tacos, pasta, stirFry, salad, eggs]
        let dinners = [tacos, pasta, stirFry, eggs, soup, tacos, pasta]
        for offset in 0..<7 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: weekStart) else { continue }
            if offset != 5 {
                book.plan.append(Planned(day: day, slot: .breakfast, mealID: oats.id))
            }
            if offset < 5 {
                book.plan.append(Planned(day: day, slot: .lunch, mealID: offset.isMultiple(of: 2) ? soup.id : salad.id))
            }
            if offset != 6 {
                book.plan.append(Planned(day: day, slot: .dinner, mealID: dinners[offset].id))
            }
        }
        book.checked = ["rolled oats", "milk", "onion", "garlic"]
        book.extras = [
            Extra(name: "Coffee beans", done: false),
            Extra(name: "Dish soap", done: true),
            Extra(name: "Bananas", done: false),
        ]
        return book
    }
}
