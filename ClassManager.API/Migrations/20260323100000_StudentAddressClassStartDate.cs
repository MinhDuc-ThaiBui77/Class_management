using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClassManager.API.Migrations
{
    /// <inheritdoc />
    public partial class StudentAddressClassStartDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Students: đổi tên cột Phone → Address (giữ dữ liệu cũ)
            migrationBuilder.RenameColumn(
                name: "Phone",
                table: "Students",
                newName: "Address");

            // Classes: thêm cột StartDate (nullable)
            migrationBuilder.AddColumn<DateTime>(
                name: "StartDate",
                table: "Classes",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Address",
                table: "Students",
                newName: "Phone");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "Classes");
        }
    }
}
