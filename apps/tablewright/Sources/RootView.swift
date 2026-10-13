import SwiftUI

enum Page: Hashable {
    case week, groceries, meals
}

struct RootView: View {
    @State private var tab: Page = .week

    var body: some View {
        TabView(selection: $tab) {
            WeekView()
                .tabItem { Label("Week", systemImage: "calendar") }
                .tag(Page.week)
            GroceryView()
                .tabItem { Label("Groceries", systemImage: "cart") }
                .tag(Page.groceries)
            MealsView()
                .tabItem { Label("Dishes", systemImage: "fork.knife") }
                .tag(Page.meals)
        }
        .task {
            // Each screenshot opens a different screen: 1 is the week as it stands.
            if DebugLaunch.shot == 3 { tab = .groceries }
            if DebugLaunch.shot == 4 { tab = .meals }
        }
    }
}

/// Which meal of which day is being chosen.
struct SlotChoice: Identifiable {
    let day: Date
    let slot: Slot
    var id: String { "\(day.timeIntervalSince1970)-\(slot.rawValue)" }
}

struct WeekView: View {
    @EnvironmentObject private var store: Store
    @State private var choosing: SlotChoice?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Button { store.moveWeek(by: -1) } label: { Image(systemName: "chevron.left") }
                            .accessibilityLabel("Previous week")
                        Spacer()
                        VStack(spacing: 2) {
                            Text(store.weekTitle)
                                .font(.headline)
                            Text("\(store.plannedThisWeek) of 21 meals planned")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button { store.moveWeek(by: 1) } label: { Image(systemName: "chevron.right") }
                            .accessibilityLabel("Next week")
                    }
                    .buttonStyle(.borderless)
                    .padding(.vertical, 4)
                    if store.book.meals.isEmpty {
                        Text("Tap any meal below to plan it. Type the dish the first time; it is kept for the next.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                ForEach(store.days, id: \.self) { day in
                    Section(dayTitle(day)) {
                        ForEach(Slot.allCases) { slot in
                            SlotRow(meal: store.planned(on: day, slot), slot: slot) {
                                choosing = SlotChoice(day: day, slot: slot)
                            }
                            .swipeActions {
                                if store.planned(on: day, slot) != nil {
                                    Button("Clear", role: .destructive) { store.clear(day, slot) }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("This week")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { AboutButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Today") { store.goToThisWeek() }
                        .disabled(store.isThisWeek)
                }
            }
            .sheet(item: $choosing) { choice in
                MealPicker(choice: choice)
                    .environmentObject(store)
            }
            .task {
                if DebugLaunch.shot == 2, let day = store.days.dropFirst(2).first {
                    choosing = SlotChoice(day: day, slot: .dinner)
                }
            }
        }
    }

    private func dayTitle(_ day: Date) -> String {
        let name = day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
        return Calendar.current.isDateInToday(day) ? "\(name) · Today" : name
    }
}

struct SlotRow: View {
    let meal: Meal?
    let slot: Slot
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: slot.symbol)
                    .foregroundStyle(.tint)
                    .frame(width: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(slot.title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let meal {
                        Text(meal.name)
                            .foregroundStyle(.primary)
                    } else {
                        Text("Tap to plan")
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(slot.title): \(meal?.name ?? "nothing planned")")
    }
}

struct MealPicker: View {
    let choice: SlotChoice
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var newName = ""

    private var trimmed: String { newName.trimmingCharacters(in: .whitespaces) }
    private var current: Meal? { store.planned(on: choice.day, choice.slot) }

    var body: some View {
        NavigationStack {
            List {
                Section("A new dish") {
                    HStack {
                        TextField("Name of the dish", text: $newName)
                            .onSubmit { addNew() }
                        Button("Add") { addNew() }
                            .buttonStyle(.borderless)
                            .disabled(trimmed.isEmpty)
                    }
                }
                Section("Your dishes") {
                    if store.book.meals.isEmpty {
                        Text("None yet. Type one above and it is kept for next time.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(store.sortedMeals) { meal in
                        Button {
                            store.set(meal, on: choice.day, choice.slot)
                            dismiss()
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(meal.name)
                                        .foregroundStyle(.primary)
                                    Text(store.summary(of: meal))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                if current?.id == meal.id {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.tint)
                                        .accessibilityLabel("Planned now")
                                }
                            }
                        }
                    }
                }
                if current != nil {
                    Section {
                        Button("Clear this meal", role: .destructive) {
                            store.clear(choice.day, choice.slot)
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle("\(choice.slot.title), \(choice.day.formatted(.dateTime.weekday(.wide)))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }

    private func addNew() {
        guard !trimmed.isEmpty else { return }
        let meal = Meal(name: trimmed, ingredients: [], note: "")
        store.add(meal)
        store.set(meal, on: choice.day, choice.slot)
        dismiss()
    }
}
