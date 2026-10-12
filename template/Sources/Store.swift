import Foundation

struct Entry: Codable, Identifiable, Hashable {
    var id = UUID()
    var title: String
    var amount: Double
    var date: Date
}

/// Everything the app knows, kept in one file. While a screenshot is being made it holds sample
/// data instead and saves nothing, so the pictures never touch what a person entered.
@MainActor
final class Store: ObservableObject {
    @Published private(set) var entries: [Entry] = []

    private let file = Saved<[Entry]>(name: "entries")
    private let sample = DebugLaunch.shot != nil

    init() {
        entries = sample ? Store.sampleEntries : (file.load() ?? [])
    }

    var total: Double { entries.reduce(0) { $0 + $1.amount } }

    func add(_ entry: Entry) {
        entries.insert(entry, at: 0)
        save()
    }

    func update(_ entry: Entry) {
        guard let index = entries.firstIndex(where: { $0.id == entry.id }) else { return }
        entries[index] = entry
        save()
    }

    func remove(_ entry: Entry) {
        entries.removeAll { $0.id == entry.id }
        save()
    }

    private func save() {
        if !sample { file.save(entries) }
    }

    private static let sampleEntries: [Entry] = {
        let day: TimeInterval = 86_400
        let now = Date()
        return [
            Entry(title: "Morning run", amount: 5.2, date: now),
            Entry(title: "Evening walk", amount: 2.4, date: now.addingTimeInterval(-day)),
            Entry(title: "Bike to work", amount: 8.1, date: now.addingTimeInterval(-2 * day)),
            Entry(title: "Hike", amount: 11.6, date: now.addingTimeInterval(-4 * day)),
            Entry(title: "Swim", amount: 1.5, date: now.addingTimeInterval(-6 * day)),
        ]
    }()
}
